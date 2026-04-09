import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { useMemo, useState, useEffect } from 'react';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import * as Y from 'yjs';
import {
  ySyncPluginKey,
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
} from 'y-prosemirror';
import { useAuth } from '../context/AuthContext';
import { useFirebaseYjs } from '../hooks/useFirebaseYjs';

const CURSOR_COLORS = ['#8B5CF6', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#EC4899'];

function getUserColor(uid) {
  return CURSOR_COLORS[
    [...(uid || '')].reduce((acc, c) => acc + c.charCodeAt(0), 0) % CURSOR_COLORS.length
  ];
}

const remoteCursorKey = new PluginKey('remote-cursors');

// Build decoration set from current awareness states.
// Returns null if binding.mapping isn't populated yet.
function buildDecorations(editorState, awareness) {
  const ystate = ySyncPluginKey.getState(editorState);
  if (!ystate?.binding) return null;
  if (ystate.binding.mapping.size === 0) return null; // not ready yet

  const { doc: ydoc, type: yXmlFragment, binding } = ystate;
  const decorations = [];

  awareness.getStates().forEach((state, clientID) => {
    if (clientID === awareness.clientID) return;
    if (!state?.cursor || !state?.user) return;

    try {
      const anchor = relativePositionToAbsolutePosition(
        ydoc, yXmlFragment,
        Y.createRelativePositionFromJSON(state.cursor.anchor),
        binding.mapping
      );
      const head = relativePositionToAbsolutePosition(
        ydoc, yXmlFragment,
        Y.createRelativePositionFromJSON(state.cursor.head),
        binding.mapping
      );
      if (anchor === null || head === null) return;

      const user = state.user;
      const max  = Math.max(editorState.doc.content.size - 1, 0);
      const cHead = Math.min(head, max);

      // Coloured caret + floating name label
      decorations.push(
        Decoration.widget(
          cHead,
          () => {
            const caret = document.createElement('span');
            caret.style.cssText = `
              display: inline-block;
              position: relative;
              border-left: 2px solid ${user.color};
              margin-left: -1px;
              pointer-events: none;
              height: 1.2em;
              vertical-align: text-bottom;
            `;
            const label = document.createElement('div');
            label.textContent = user.name;
            label.style.cssText = `
              position: absolute;
              top: -1.6em;
              left: -1px;
              background: ${user.color};
              color: #fff;
              font-size: 10px;
              font-weight: 700;
              font-family: monospace;
              padding: 2px 6px;
              border-radius: 3px 3px 3px 0;
              white-space: nowrap;
              pointer-events: none;
              user-select: none;
              letter-spacing: 0.05em;
              line-height: normal;
            `;
            caret.appendChild(label);
            return caret;
          },
          { key: `cursor-${clientID}`, side: 10 }
        )
      );

      // Translucent selection highlight
      const from = Math.min(anchor, head);
      const to   = Math.max(anchor, head);
      if (from !== to) {
        decorations.push(
          Decoration.inline(
            Math.min(from, max + 1),
            Math.min(to,   max + 1),
            { style: `background-color: ${user.color}33;` },
            { inclusiveEnd: true, inclusiveStart: false }
          )
        );
      }
    } catch (_) {
      // stale relative position during rapid edits — safe to skip
    }
  });

  return DecorationSet.create(editorState.doc, decorations);
}

function buildCursorExtension(awareness) {
  return Extension.create({
    name: 'firestoreCursors',
    // Priority 900: runs after Collaboration (1000) so ySyncPlugin
    // is registered before our plugin's init is called.
    priority: 900,

    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: remoteCursorKey,

          state: {
            init(_config, editorState) {
              // mapping.size is 0 here — return empty and wait for view.update
              return buildDecorations(editorState, awareness) ?? DecorationSet.empty;
            },

            // apply(tr, prevPluginState, oldEditorState, newEditorState)
            // newEditorState is the fully-built new state — safe to call getState on
            apply(tr, prev, _old, newState) {
              const meta = tr.getMeta(remoteCursorKey);
              if (!meta?.redraw && !tr.docChanged) {
                return prev.map(tr.mapping, tr.doc);
              }
              return buildDecorations(newState, awareness) ?? DecorationSet.empty;
            },
          },

          props: {
            decorations(state) {
              return remoteCursorKey.getState(state);
            },
          },

          view(editorView) {
            const redraw = () => {
              if (!editorView.docView) return;
              editorView.dispatch(
                editorView.state.tr.setMeta(remoteCursorKey, { redraw: true })
              );
            };

            // Redraw when any remote cursor changes
            awareness.on('change', redraw);

            // The binding.mapping is populated after ySyncPlugin calls
            // _forceRerender, which mutates the editor DOM. Watch for that
            // with a MutationObserver and do one redraw when it fires.
            let mappingReady = false;
            const observer = new MutationObserver(() => {
              if (mappingReady) return;
              const ystate = ySyncPluginKey.getState(editorView.state);
              if (ystate?.binding?.mapping.size > 0) {
                mappingReady = true;
                observer.disconnect();
                redraw();
              }
            });
            observer.observe(editorView.dom, {
              childList: true,
              subtree: true,
              characterData: true,
            });

            return {
              destroy() {
                awareness.off('change', redraw);
                observer.disconnect();
              },
            };
          },
        }),
      ];
    },
  });
}

// Push our own selection into awareness on every cursor/selection move
function useCursorSync(editor, awareness, ydoc) {
  useEffect(() => {
    if (!editor || !awareness || !ydoc) return;

    const syncCursor = () => {
      const ystate = ySyncPluginKey.getState(editor.state);
      if (!ystate?.binding?.mapping.size) return; // wait until mapping is ready

      const { type: yXmlFragment, binding } = ystate;
      const { from, to } = editor.state.selection;

      try {
        const anchor = absolutePositionToRelativePosition(from, yXmlFragment, binding.mapping);
        const head   = absolutePositionToRelativePosition(to,   yXmlFragment, binding.mapping);
        awareness.setLocalStateField('cursor', {
          anchor: Y.relativePositionToJSON(anchor),
          head:   Y.relativePositionToJSON(head),
        });
      } catch (_) {}
    };

    editor.on('selectionUpdate', syncCursor);
    editor.on('focus',           syncCursor);
    editor.on('update',          syncCursor);

    return () => {
      editor.off('selectionUpdate', syncCursor);
      editor.off('focus',           syncCursor);
      editor.off('update',          syncCursor);
    };
  }, [editor, awareness, ydoc]);
}

// ── MenuBar ───────────────────────────────────────────────────────────────────
const MenuBar = ({ editor }) => {
  const [updated, setUpdated] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const updateHandler = () => setUpdated(s => s + 1);
    editor.on('transaction', updateHandler);
    return () => editor.off('transaction', updateHandler);
  }, [editor]);

  if (!editor) return null;

  const getBtnClass = (name, attributes = {}) => {
    const active = editor.isActive(name, attributes);
    return `px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all duration-200 border ${
      active 
        ? "bg-purple-600 text-white border-purple-600 shadow-lg scale-95" 
        : "bg-slate-50 text-slate-400 border-slate-100 hover:bg-purple-50 hover:text-purple-600"
    }`;
  };

  return (
    <div className="flex flex-wrap gap-2 p-4 border-b border-slate-100 bg-white sticky top-0 z-10">
      <button onClick={() => editor.chain().focus().toggleBold().run()} className={getBtnClass("bold")}>B</button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={getBtnClass("italic")}>I</button>
      <button onClick={() => editor.chain().focus().toggleStrike().run()} className={getBtnClass("strike")}>S</button>
      
      <div className="w-px h-6 bg-slate-200 mx-1"></div>
      
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={getBtnClass("heading", { level: 1 })}>H1</button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={getBtnClass("heading", { level: 2 })}>H2</button>
      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={getBtnClass("bulletList")}>List</button>
      
      <button 
        onClick={() => editor.chain().focus().clearContent(true).run()} 
        className="ml-auto px-4 py-2 rounded-xl text-[10px] font-black text-rose-500 hover:bg-rose-50 tracking-widest uppercase"
      >
        Clear
      </button>
  const btnClass = (active) =>
    `px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
      active
        ? 'bg-purple-600 text-white shadow-md'
        : 'bg-slate-100 text-slate-600 hover:bg-purple-100 hover:text-purple-600'
    }`;
  return (
    <div className="flex flex-wrap gap-2 p-3 border-b border-slate-100 bg-slate-50/50">
      <button onClick={() => editor.chain().focus().toggleBold().run()}       className={btnClass(editor.isActive('bold'))}>B</button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()}     className={btnClass(editor.isActive('italic'))}>I</button>
      <button onClick={() => editor.chain().focus().toggleStrike().run()}     className={btnClass(editor.isActive('strike'))}>S</button>
      <div className="w-px h-6 bg-slate-200 mx-1" />
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btnClass(editor.isActive('heading', { level: 1 }))}>H1</button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btnClass(editor.isActive('heading', { level: 2 }))}>H2</button>
      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive('bulletList'))}>List</button>
    </div>
  );
};

// Coloured name pills showing who's currently in the editor
function ActiveUsers({ awareness }) {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    if (!awareness) return;
    const update = () => {
      const all = [];
      awareness.getStates().forEach((state) => { if (state?.user) all.push(state.user); });
      setUsers(all);
    };
    update();
    awareness.on('change', update);
    return () => awareness.off('change', update);
  }, [awareness]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {users.map((u, i) => (
        <div
          key={i}
          className="flex items-center gap-1.5 px-2 py-1 rounded-full text-white text-[10px] font-bold"
          style={{ backgroundColor: u.color }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white opacity-80 animate-pulse" />
          {u.name}
        </div>
      ))}
    </div>
  );
}

// ── Inner editor — mounts only once ydoc + awareness are ready ────────────────
function EditorInner({ ydoc, awareness }) {
  const cursorExtension = useMemo(() => buildCursorExtension(awareness), []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }),
      ydoc ? Collaboration.configure({ document: ydoc }) : null,
    ].filter(Boolean),
      Collaboration.configure({ document: ydoc }), // priority 1000 — ySyncPlugin registered first
      cursorExtension,                              // priority 900  — cursor plugin registered after
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-purple max-w-none focus:outline-none min-h-[400px] px-8 py-6 text-slate-700 leading-relaxed outline-none',
      },
    },
  }, [ydoc]); 

  if (!ydoc || !editor) {
    return (
      <div className="bg-white rounded-[2.5rem] shadow-xl border border-purple-50 h-[500px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin"></div>
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Connecting Sync...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2.5rem] shadow-2xl border border-purple-50 overflow-hidden flex flex-col h-full min-h-[500px]">
      <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-white">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase italic">Shared Notes</h2>
          <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.4em] mt-1">Synced via Firestore</p>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-full border border-blue-100">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Active</span>
  });

  useCursorSync(editor, awareness, ydoc);

  return (
    <div className="bg-white rounded-[2rem] shadow-xl border border-purple-50 overflow-hidden flex flex-col h-full min-h-[500px]">
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Shared Notes</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Synced via Firestore</p>
        </div>
        <div className="flex items-center gap-3">
          <ActiveUsers awareness={awareness} />
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-bold text-blue-600">Live</span>
          </div>
        </div>
      </div>

      <MenuBar editor={editor} />

      <div className="flex-grow bg-white overflow-y-auto cursor-text custom-scrollbar">
        <EditorContent editor={editor} />
      </div>

      <style>{`
        .ProseMirror { min-height: 400px; outline: none !important; }
        .ProseMirror h1 { font-size: 2em; font-weight: bold; margin-bottom: 0.5em; color: #1e293b; }
        .ProseMirror h2 { font-size: 1.5em; font-weight: bold; margin-bottom: 0.5em; color: #1e293b; }
        .ProseMirror ul { list-style-type: disc; padding-left: 1.5em; margin-bottom: 1em; }
        .ProseMirror li { margin-bottom: 0.25em; color: #334155; }
      `}`</style>
    </div>
  );
}

// ── Outer shell ───────────────────────────────────────────────────────────────
export default function CollaborativeEditor({ roomId }) {
  const { user } = useAuth();

  const currentUser = useMemo(() => {
    if (!user) return null;
    return {
      uid:   user.uid,
      name:  user.displayName || user.email?.split('@')[0] || 'Scholar',
      color: getUserColor(user.uid),
    };
  }, [user]);

  const { ydoc, awareness } = useFirebaseYjs(roomId, currentUser) || {};

  if (!ydoc || !awareness) {
    return (
      <div className="bg-white rounded-[2rem] shadow-xl border border-purple-50 h-[500px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Connecting…</p>
        </div>
      </div>
    );
  }

  return <EditorInner key={roomId} ydoc={ydoc} awareness={awareness} />;
}
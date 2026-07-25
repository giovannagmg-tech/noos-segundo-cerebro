import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import ImageExtension from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { Markdown } from 'tiptap-markdown'
import { toast } from 'sonner'
import { uploadNoteImage } from '@/lib/api/media'

// tiptap-markdown injeta editor.storage.markdown em runtime mas não expõe
// tipos pra ele — augmenta só o suficiente pra ler de volta sem `any`.
type MarkdownStorage = { markdown: { getMarkdown: () => string } }
function getMarkdown(editor: { storage: unknown }): string {
  return (editor.storage as MarkdownStorage).markdown.getMarkdown()
}

type NoteEditorProps = {
  noteId: string
  content: string
  onChange: (markdown: string) => void
  onBlur?: () => void
  placeholder?: string
}

// Editor WYSIWYG (TipTap) que lê/escreve Markdown puro em `notes.content` —
// nada muda no backend (busca full-text, embeddings, parser de [[wikilinks]]
// em syncWikilinks continuam operando sobre a mesma string de sempre). O
// extension Markdown (tiptap-markdown) é quem faz a ponte: o editor mostra
// blocos renderizados, mas editor.storage.markdown.getMarkdown() devolve
// Markdown de novo pra salvar.
export function NoteEditor({ noteId, content, onChange, onBlur, placeholder }: NoteEditorProps) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  function insertImage(file: File, pos?: number) {
    toast.promise(uploadNoteImage(noteId, file), {
      loading: 'Enviando imagem…',
      success: (media) => {
        const insertAt = pos ?? editor?.state.selection.from
        editor
          ?.chain()
          .focus()
          .insertContentAt(insertAt ?? 0, { type: 'image', attrs: { src: media.public_url } })
          .run()
        return 'Imagem enviada.'
      },
      error: (err) => (err instanceof Error ? err.message : 'Falha ao enviar a imagem.'),
    })
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      ImageExtension.configure({ HTMLAttributes: { class: 'noos-editor-image' } }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: placeholder ?? 'Comece a escrever, ou cole do Notion/Obsidian…' }),
      Markdown.configure({ html: false, transformPastedText: false }),
    ],
    content,
    editorProps: {
      attributes: { class: 'noos-editor-content' },
      handleDrop(view, event, _slice, moved) {
        if (moved) return false
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) =>
          f.type.startsWith('image/'),
        )
        if (!files.length) return false
        event.preventDefault()
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
        const pos = coords?.pos ?? view.state.selection.from
        files.forEach((file) => insertImage(file, pos))
        return true
      },
      handlePaste(_view, event) {
        const files = Array.from(event.clipboardData?.items ?? [])
          .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
          .map((item) => item.getAsFile())
          .filter((f): f is File => f !== null)
        if (!files.length) return false
        event.preventDefault()
        files.forEach((file) => insertImage(file))
        return true
      },
    },
    onUpdate({ editor }) {
      onChangeRef.current(getMarkdown(editor))
    },
    onBlur() {
      onBlur?.()
    },
  })

  // Troca de nota (navegação /notes/:id → /notes/:id2) precisa recarregar o
  // conteúdo do editor sem dar update loop nem disparar autosave à toa.
  useEffect(() => {
    if (!editor) return
    editor.commands.setContent(content, { emitUpdate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId])

  return <EditorContent editor={editor} />
}

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { TagPill } from '@/components/TagPill'
import { createNote, listNotes, listNotesByTag, searchNotes } from '@/lib/api/notes'
import { listTags, type TagWithCount } from '@/lib/api/tags'
import { importNote } from '@/lib/api/suggestions'
import type { NoteWithTags, SearchResult } from '@/lib/api/types'

const SOURCE_LABEL: Record<string, string> = {
  notion: 'Notion',
  obsidian: 'Obsidian',
  noos: 'Noos',
  mobile_capture: 'Captura mobile',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default function Notes() {
  const navigate = useNavigate()
  const [notes, setNotes] = useState<NoteWithTags[]>([])
  const [tags, setTags] = useState<TagWithCount[]>([])
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    listTags().then(setTags).catch(() => {})
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (debouncedQuery) {
        setSearching(true)
        try {
          const results = await searchNotes(debouncedQuery)
          if (!cancelled) setSearchResults(results)
        } catch (err) {
          console.error(err)
          if (!cancelled) toast.error('Falha na busca. Tentar novamente.')
        } finally {
          if (!cancelled) setSearching(false)
        }
        return
      }
      setSearchResults(null)
      setLoading(true)
      try {
        const data = selectedTag === 'all' ? await listNotes() : await listNotesByTag(selectedTag)
        if (!cancelled) setNotes(data)
      } catch (err) {
        console.error(err)
        if (!cancelled) toast.error('Não foi possível carregar suas notas.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, selectedTag])

  const quickCaptures = useMemo(() => notes.filter((n) => n.is_quick_capture), [notes])
  const regularNotes = useMemo(() => notes.filter((n) => !n.is_quick_capture), [notes])

  async function handleNewNote() {
    setCreating(true)
    try {
      const note = await createNote({ title: 'Nota sem título' })
      navigate(`/notes/${note.id}`)
    } catch {
      toast.error('Falha ao criar nota.')
    } finally {
      setCreating(false)
    }
  }

  const isSearchMode = debouncedQuery.length > 0

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Suas notas</h1>
        <div className="flex gap-2">
          <ImportNoteDialog onImported={(noteId) => navigate(`/notes/${noteId}`)} />
          <Button onClick={handleNewNote} disabled={creating}>
            + Nova nota
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Buscar notas…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <Select value={selectedTag} onValueChange={setSelectedTag} disabled={isSearchMode}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todas as tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as tags</SelectItem>
            {tags.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                {tag.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isSearchMode ? (
        <SearchResults results={searchResults} loading={searching} query={debouncedQuery} />
      ) : loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-24 text-center">
          <p className="text-sm text-muted-foreground">
            Crie sua primeira nota ou importe do Notion/Obsidian — a importação é sempre
            incremental, nota a nota.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {quickCaptures.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                Inbox — capturas rápidas ({quickCaptures.length})
              </h2>
              <NoteList items={quickCaptures} onOpen={(id) => navigate(`/notes/${id}`)} />
            </section>
          )}
          <section className="flex flex-col gap-2">
            {quickCaptures.length > 0 && (
              <h2 className="text-sm font-medium text-muted-foreground">Notas</h2>
            )}
            {regularNotes.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma nota nesta tag.
              </p>
            ) : (
              <NoteList items={regularNotes} onOpen={(id) => navigate(`/notes/${id}`)} />
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function NoteList({ items, onOpen }: { items: NoteWithTags[]; onOpen: (id: string) => void }) {
  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {items.map((note) => (
        <li key={note.id}>
          <button
            onClick={() => onOpen(note.id)}
            className="flex w-full flex-col gap-1.5 px-4 py-3 text-left hover:bg-muted/50"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{note.title || 'Sem título'}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDate(note.updated_at)}
              </span>
            </div>
            {note.content && (
              <p className="line-clamp-1 text-sm text-muted-foreground">{note.content}</p>
            )}
            {(note.tags.length > 0 || note.source) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {note.source && note.source !== 'noos' && (
                  <span className="text-xs text-muted-foreground">
                    {SOURCE_LABEL[note.source] ?? note.source}
                  </span>
                )}
                {note.tags.map((tag) => (
                  <TagPill key={tag.id} tag={tag} />
                ))}
              </div>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}

function SearchResults({
  results,
  loading,
  query,
}: {
  results: SearchResult[] | null
  loading: boolean
  query: string
}) {
  const navigate = useNavigate()
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }
  if (!results || results.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Nenhuma nota encontrada para "{query}".
      </p>
    )
  }
  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {results.map((r) => (
        <li key={r.id}>
          <button
            onClick={() => navigate(`/notes/${r.id}`)}
            className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-muted/50"
          >
            <span className="font-medium">{r.title}</span>
            <p className="text-sm text-muted-foreground">{renderSnippet(r.snippet)}</p>
          </button>
        </li>
      ))}
    </ul>
  )
}

// ts_headline devolve o trecho com os termos casados entre <b>...</b>. Faz o
// parsing manual em vez de dangerouslySetInnerHTML — o texto original é do
// próprio usuário, então não deve ser injetado como HTML bruto no DOM.
function renderSnippet(snippet: string) {
  const parts = snippet.split(/<\/?b>/g)
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-medium text-foreground">
        {part}
      </strong>
    ) : (
      part
    ),
  )
}

function ImportNoteDialog({ onImported }: { onImported: (noteId: string) => void }) {
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState<'notion' | 'obsidian'>('notion')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [importing, setImporting] = useState(false)

  async function handleImport() {
    if (!title.trim() || !content.trim()) return
    setImporting(true)
    try {
      const result = await importNote({ title: title.trim(), content, source })
      const unresolved = result.unresolved_links.length
      toast.success(
        `Nota importada — ${result.created_links} link(s) criado(s)` +
          (unresolved ? `, ${unresolved} título(s) não encontrado(s)` : ''),
      )
      setOpen(false)
      setTitle('')
      setContent('')
      onImported(result.note_id)
    } catch (err) {
      console.error(err)
      toast.error('Falha ao importar — confira se as Edge Functions estão deployadas.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Importar do Notion/Obsidian</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar nota</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label>Origem</Label>
            <Select value={source} onValueChange={(v) => setSource(v as 'notion' | 'obsidian')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="notion">Notion</SelectItem>
                <SelectItem value="obsidian">Obsidian</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="import-title">Título</Label>
            <Input id="import-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="import-content">Conteúdo</Label>
            <Textarea
              id="import-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              placeholder="Cole o conteúdo markdown aqui. [[Título de outra nota]] vira link automaticamente."
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleImport} disabled={importing}>
            {importing ? 'Importando...' : 'Importar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

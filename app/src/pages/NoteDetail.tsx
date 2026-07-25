import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { TagPill } from '@/components/TagPill'
import {
  addTagToNote,
  createExternalReference,
  createNoteLink,
  deleteExternalReference,
  deleteNoteLink,
  getNote,
  listExternalReferences,
  listLinksForNote,
  listNotes,
  removeTagFromNote,
  syncWikilinks,
  updateNote,
} from '@/lib/api/notes'
import { createTag, listTags, type TagWithCount } from '@/lib/api/tags'
import { nextTagColor } from '@/lib/tag-colors'
import {
  acceptSuggestion,
  dismissSuggestion,
  generateEmbeddingAndSuggestions,
  listSuggestionsForNote,
  type PendingSuggestion,
} from '@/lib/api/suggestions'
import type { ExternalReference, Note, NoteLink, NoteWithTags } from '@/lib/api/types'

type SaveState = 'idle' | 'saving' | 'saved'

export default function NoteDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [note, setNote] = useState<NoteWithTags | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const [allTags, setAllTags] = useState<TagWithCount[]>([])
  const [allNotes, setAllNotes] = useState<Note[]>([])
  const [links, setLinks] = useState<{
    outgoing: (NoteLink & { target: Note })[]
    incoming: (NoteLink & { source: Note })[]
  }>({ outgoing: [], incoming: [] })
  const [refs, setRefs] = useState<ExternalReference[]>([])
  const [suggestions, setSuggestions] = useState<PendingSuggestion[]>([])

  const [tagPopoverOpen, setTagPopoverOpen] = useState(false)
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false)
  const [refDialogOpen, setRefDialogOpen] = useState(false)
  const [refLabel, setRefLabel] = useState('')
  const [refUrl, setRefUrl] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setNotFound(false)
    try {
      const [n, tags, notes, noteLinks, references, pendingSuggestions] = await Promise.all([
        getNote(id),
        listTags(),
        listNotes(),
        listLinksForNote(id),
        listExternalReferences(id),
        listSuggestionsForNote(id).catch(() => []),
      ])
      if (!n) {
        setNotFound(true)
        return
      }
      setNote(n)
      setTitle(n.title)
      setContent(n.content ?? '')
      setAllTags(tags)
      setAllNotes(notes)
      setLinks(noteLinks)
      setRefs(references)
      setSuggestions(pendingSuggestions)
    } catch (err) {
      console.error(err)
      toast.error('Falha ao carregar a nota.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function saveTitle() {
    if (!id || !note || title === note.title) return
    setSaveState('saving')
    try {
      await updateNote(id, { title })
      setNote((n) => (n ? { ...n, title } : n))
      setSaveState('saved')
    } catch {
      toast.error('Falha ao salvar a nota.')
      setSaveState('idle')
    }
  }

  async function saveContent() {
    if (!id || !note || content === (note.content ?? '')) return
    setSaveState('saving')
    try {
      await updateNote(id, { content })
      await syncWikilinks(id, content, allNotes)
      const noteLinks = await listLinksForNote(id)
      setLinks(noteLinks)
      setNote((n) => (n ? { ...n, content } : n))
      setSaveState('saved')
    } catch {
      toast.error('Falha ao salvar a nota.')
      setSaveState('idle')
      return
    }
    // Melhor esforço: gera embedding + sugestões de conexão em segundo plano.
    // Se as Edge Functions ainda não estiverem deployadas, falha em silêncio.
    generateEmbeddingAndSuggestions(id)
      .then(() => listSuggestionsForNote(id))
      .then(setSuggestions)
      .catch((err) => console.error('IA de conexões indisponível:', err))
  }

  async function handleAcceptSuggestion(s: PendingSuggestion) {
    try {
      await acceptSuggestion(s)
      setSuggestions((prev) => prev.filter((x) => x.id !== s.id))
      setLinks(await listLinksForNote(id!))
    } catch {
      toast.error('Falha ao aceitar sugestão.')
    }
  }

  async function handleDismissSuggestion(suggestionId: string) {
    try {
      await dismissSuggestion(suggestionId)
      setSuggestions((prev) => prev.filter((x) => x.id !== suggestionId))
    } catch {
      toast.error('Falha ao dispensar sugestão.')
    }
  }

  async function handleAddTag(tagId: string) {
    if (!id) return
    try {
      await addTagToNote(id, tagId)
      const tag = allTags.find((t) => t.id === tagId)
      if (tag) setNote((n) => (n ? { ...n, tags: [...n.tags, tag] } : n))
      setTagPopoverOpen(false)
    } catch {
      toast.error('Falha ao adicionar tag.')
    }
  }

  async function handleCreateAndAddTag(name: string) {
    try {
      const tag = await createTag(name, nextTagColor(allTags.length))
      setAllTags((t) => [...t, { ...tag, note_count: 0 }])
      await handleAddTag(tag.id)
    } catch {
      toast.error('Falha ao criar tag.')
    }
  }

  async function handleRemoveTag(tagId: string) {
    if (!id) return
    try {
      await removeTagFromNote(id, tagId)
      setNote((n) => (n ? { ...n, tags: n.tags.filter((t) => t.id !== tagId) } : n))
    } catch {
      toast.error('Falha ao remover tag.')
    }
  }

  async function handleAddLink(targetId: string) {
    if (!id) return
    try {
      await createNoteLink(id, targetId)
      setLinks(await listLinksForNote(id))
      setLinkPopoverOpen(false)
    } catch {
      toast.error('Falha ao criar link.')
    }
  }

  async function handleRemoveLink(linkId: string) {
    if (!id) return
    try {
      await deleteNoteLink(linkId)
      setLinks(await listLinksForNote(id))
    } catch {
      toast.error('Falha ao remover link.')
    }
  }

  async function handleAddReference() {
    if (!id || !refLabel.trim()) return
    try {
      await createExternalReference({ noteId: id, label: refLabel.trim(), url: refUrl.trim() })
      setRefs(await listExternalReferences(id))
      setRefLabel('')
      setRefUrl('')
      setRefDialogOpen(false)
    } catch {
      toast.error('Falha ao salvar referência.')
    }
  }

  async function handleRemoveReference(refId: string) {
    if (!id) return
    try {
      await deleteExternalReference(refId)
      setRefs((r) => r.filter((x) => x.id !== refId))
    } catch {
      toast.error('Falha ao remover referência.')
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (notFound || !note) {
    return (
      <div className="mx-auto max-w-md py-24 text-center text-sm text-muted-foreground">
        Nota não encontrada.
      </div>
    )
  }

  const availableTags = allTags.filter((t) => !note.tags.some((nt) => nt.id === t.id))
  const linkableNotes = allNotes.filter(
    (n) =>
      n.id !== id &&
      !links.outgoing.some((l) => l.target_note_id === n.id) &&
      !links.incoming.some((l) => l.source_note_id === n.id),
  )

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          placeholder="Título da nota"
          className="border-none px-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
        />
        <span className="shrink-0 text-xs text-muted-foreground">
          {saveState === 'saving' ? 'Salvando…' : saveState === 'saved' ? 'Salvo' : ''}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {note.tags.map((tag) => (
          <TagPill key={tag.id} tag={tag} onRemove={() => handleRemoveTag(tag.id)} />
        ))}
        <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              className="rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:border-foreground hover:text-foreground"
              aria-label="Adicionar tag"
            >
              + tag
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <TagPicker
              options={availableTags}
              onSelect={handleAddTag}
              onCreate={handleCreateAndAddTag}
            />
          </PopoverContent>
        </Popover>
      </div>

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={saveContent}
        placeholder="Comece a escrever, ou cole do Notion/Obsidian. Use [[Título da Nota]] pra linkar outra nota."
        rows={16}
        className="font-mono text-sm"
      />

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Notas linkadas</h2>
          <Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                + Link
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="end">
              <Command>
                <CommandInput placeholder="Buscar nota…" />
                <CommandList>
                  <CommandEmpty>Nenhuma nota encontrada.</CommandEmpty>
                  <CommandGroup>
                    {linkableNotes.map((n) => (
                      <CommandItem key={n.id} onSelect={() => handleAddLink(n.id)}>
                        {n.title || 'Sem título'}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        {links.outgoing.length === 0 && links.incoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma conexão ainda — use [[ ]] no texto ou o botão + Link.
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {links.outgoing.map((l) => (
              <LinkRow
                key={l.id}
                title={l.target.title}
                onOpen={() => navigate(`/notes/${l.target_note_id}`)}
                onRemove={() => handleRemoveLink(l.id)}
              />
            ))}
            {links.incoming.map((l) => (
              <LinkRow
                key={l.id}
                title={l.source.title}
                subtitle="menciona esta nota"
                onOpen={() => navigate(`/notes/${l.source_note_id}`)}
                onRemove={() => handleRemoveLink(l.id)}
              />
            ))}
          </ul>
        )}
      </section>

      {suggestions.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">Sugestões da IA</h2>
          <ul className="flex flex-col divide-y rounded-lg border">
            {suggestions.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => navigate(`/notes/${s.otherNoteId}`)}
                    className="text-left text-sm font-medium hover:underline"
                  >
                    {s.otherNoteTitle}
                  </button>
                  {s.score !== null && (
                    <span className="text-xs text-muted-foreground">
                      {Math.round(s.score * 100)}% similar
                    </span>
                  )}
                </div>
                {s.reason && <p className="text-xs text-muted-foreground">{s.reason}</p>}
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleAcceptSuggestion(s)}>
                    Aceitar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDismissSuggestion(s.id)}>
                    Descartar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Referências externas</h2>
          <Dialog open={refDialogOpen} onOpenChange={setRefDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                + Referência
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova referência externa</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="ref-label">Título / autor / curso</Label>
                  <Input id="ref-label" value={refLabel} onChange={(e) => setRefLabel(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ref-url">URL (opcional)</Label>
                  <Input id="ref-url" value={refUrl} onChange={(e) => setRefUrl(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddReference}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        {refs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma referência externa ainda.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {refs.map((ref) => (
              <li key={ref.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                {ref.url ? (
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm underline-offset-2 hover:underline"
                  >
                    {ref.label}
                  </a>
                ) : (
                  <span className="text-sm">{ref.label}</span>
                )}
                <button
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => handleRemoveReference(ref.id)}
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function LinkRow({
  title,
  subtitle,
  onOpen,
  onRemove,
}: {
  title: string
  subtitle?: string
  onOpen: () => void
  onRemove: () => void
}) {
  return (
    <li className="flex items-center justify-between gap-2 px-4 py-2.5">
      <button onClick={onOpen} className="flex-1 text-left text-sm hover:underline">
        {title || 'Sem título'}
        {subtitle && <span className="ml-2 text-xs text-muted-foreground">({subtitle})</span>}
      </button>
      <button className="text-xs text-muted-foreground hover:text-foreground" onClick={onRemove}>
        Remover
      </button>
    </li>
  )
}

function TagPicker({
  options,
  onSelect,
  onCreate,
}: {
  options: TagWithCount[]
  onSelect: (id: string) => void
  onCreate: (name: string) => void
}) {
  const [search, setSearch] = useState('')
  const exactMatch = options.some((o) => o.name.toLowerCase() === search.trim().toLowerCase())

  return (
    <Command>
      <CommandInput placeholder="Buscar ou criar tag…" value={search} onValueChange={setSearch} />
      <CommandList>
        <CommandGroup>
          {options
            .filter((o) => o.name.toLowerCase().includes(search.trim().toLowerCase()))
            .map((tag) => (
              <CommandItem key={tag.id} onSelect={() => onSelect(tag.id)}>
                <span
                  className="mr-2 size-2 rounded-full"
                  style={{ backgroundColor: tag.color ?? '#999' }}
                />
                {tag.name}
              </CommandItem>
            ))}
        </CommandGroup>
        {search.trim() && !exactMatch && (
          <CommandGroup>
            <CommandItem onSelect={() => onCreate(search.trim())}>
              Criar tag "{search.trim()}"
            </CommandItem>
          </CommandGroup>
        )}
        {!search.trim() && options.length === 0 && (
          <CommandEmpty>Todas as tags já estão aplicadas.</CommandEmpty>
        )}
      </CommandList>
    </Command>
  )
}

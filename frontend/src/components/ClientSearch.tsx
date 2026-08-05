"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Users, Building2 } from "lucide-react"
import { useAuth } from "@/components/auth/AuthProvider"
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"

interface ClientResult {
  id: string
  name: string
  company_name: string | null
  email: string | null
  status: string | null
  is_active: boolean | null
}

export function ClientSearch() {
  const [open, setOpen] = useState(false)
  const [clients, setClients] = useState<ClientResult[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const fetchClients = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const supabase = createClientComponentClient()
    const { data } = await supabase
      .from("clients")
      .select("id, name, company_name, email, status, is_active")
      .or("status.eq.active,status.eq.pending,status.eq.staff,status.is.null")
      .order("name")
    setClients(data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (open) fetchClients()
  }, [open, fetchClients])

  const handleSelect = (clientId: string) => {
    setOpen(false)
    router.push(`/clients/${clientId}`)
  }

  if (!user) return null

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search clients..." />
      <CommandList>
        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : (
          <>
            <CommandEmpty>No clients found.</CommandEmpty>
            <CommandGroup heading="Clients">
              {clients.map((client) => (
                <CommandItem
                  key={client.id}
                  value={`${client.name} ${client.company_name ?? ""}`}
                  onSelect={() => handleSelect(client.id)}
                >
                  <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span>{client.name}</span>
                    {client.company_name && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        {client.company_name}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}

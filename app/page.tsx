'use client'

import { FormEvent, useMemo, useState } from 'react'
import { CheckCircle2, Clipboard, Globe2, Loader2, Search, ShieldCheck, TriangleAlert } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'SOA', 'CAA', 'SRV'] as const

type RecordType = (typeof recordTypes)[number]
type DnsRecord = { name: string; type: number; data: string; TTL?: number }
type LookupResult = { type: RecordType; records: DnsRecord[] }

function cleanDomain(value: string) {
  return value.trim().replace(/^https?:\/\//, '').split('/')[0].replace(/\.$/, '')
}

export default function Page() {
  const [domain, setDomain] = useState('example.com')
  const [searchedDomain, setSearchedDomain] = useState('')
  const [results, setResults] = useState<LookupResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const totalRecords = useMemo(() => results.reduce((total, result) => total + result.records.length, 0), [results])

  async function checkDns(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = cleanDomain(domain)
    if (!normalized || !normalized.includes('.')) {
      setError('Enter a valid domain, like example.com.')
      setResults([])
      return
    }

    setIsLoading(true)
    setError('')
    setSearchedDomain(normalized)
    try {
      const responses = await Promise.all(recordTypes.map(async (type) => {
        const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(normalized)}&type=${type}`, { headers: { Accept: 'application/dns-json' } })
        if (!response.ok) throw new Error('DNS lookup failed')
        const data = await response.json()
        return { type, records: (data.Answer ?? []) as DnsRecord[] }
      }))
      setResults(responses.filter((result) => result.records.length > 0))
    } catch {
      setError('We could not reach the DNS resolver. Please try again.')
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }

  async function copyResults() {
    const text = results.flatMap((result) => result.records.map((record) => `${result.type}\t${record.data}`)).join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <div className="flex w-full max-w-md flex-col gap-6">
        <header className="flex flex-col gap-2 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Globe2 aria-hidden="true" className="size-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">DNS record checker</h1>
          <p className="text-sm text-muted-foreground">Look up the public DNS records for any domain. Fast, simple, and free.</p>
        </header>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Check a domain</CardTitle>
            <CardDescription>Enter a domain name to see its current DNS configuration.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={checkDns} className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Label htmlFor="domain">Domain name</Label>
                <Input id="domain" value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="example.com" autoComplete="url" aria-invalid={Boolean(error)} />
                {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              </div>
              <Button type="submit" size="lg" disabled={isLoading} className="sm:min-w-32">
                {isLoading ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Search data-icon="inline-start" />}
                {isLoading ? 'Checking' : 'Check DNS'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {searchedDomain && !isLoading && !error && (
          <section aria-live="polite" className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Results for {searchedDomain}</h2>
                <p className="text-sm text-muted-foreground">{totalRecords} public record{totalRecords === 1 ? '' : 's'} found</p>
              </div>
              {totalRecords > 0 && <Button type="button" variant="outline" size="sm" onClick={copyResults}>{copied ? <CheckCircle2 data-icon="inline-start" /> : <Clipboard data-icon="inline-start" />}{copied ? 'Copied' : 'Copy all'}</Button>}
            </div>

            {totalRecords > 0 ? (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead className="w-24">Type</TableHead><TableHead>Value</TableHead><TableHead className="hidden w-24 text-right sm:table-cell">TTL</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.flatMap((result) => result.records.map((record, index) => <TableRow key={`${result.type}-${record.data}-${index}`}><TableCell><Badge variant="secondary" className="font-mono text-xs">{result.type}</Badge></TableCell><TableCell className="max-w-[260px] break-all font-mono text-xs sm:max-w-none sm:text-sm">{record.data}</TableCell><TableCell className="hidden text-right font-mono text-xs text-muted-foreground sm:table-cell">{record.TTL ?? '—'}</TableCell></TableRow>))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Card><CardContent className="flex flex-col items-center gap-3 py-10 text-center"><TriangleAlert className="size-8 text-yellow-500" /><p className="font-medium">No records found</p><p className="text-sm text-muted-foreground">This domain did not return any of the common record types.</p></CardContent></Card>
            )}
          </section>
        )}

        <footer className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground"><ShieldCheck className="size-4" /> Lookups use Google&apos;s public DNS-over-HTTPS resolver.</footer>
      </div>
    </main>
  )
}

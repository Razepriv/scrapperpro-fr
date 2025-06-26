"use client";

import { useState, useTransition, useCallback, ChangeEvent, DragEvent } from 'react';
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { ArrowRight, Loader2, Trash2, UploadCloud } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { useToast } from "@/hooks/use-toast"
import { type Property, scrapeUrl, scrapeHtml, scrapeBulk, saveProperty } from '@/app/actions';
import { ResultsTable } from './results-table';
import { downloadJson, downloadCsv, downloadExcel } from '@/lib/export';

const UrlFormSchema = z.object({
  url: z.string().url({ message: "Please enter a valid URL." }),
})

const HtmlFormSchema = z.object({
  html: z.string().min(100, { message: "Please enter a substantial amount of HTML."}),
})

export function MainPage() {
  const [results, setResults] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [bulkUrls, setBulkUrls] = useState('');

  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const urlForm = useForm<z.infer<typeof UrlFormSchema>>({
    resolver: zodResolver(UrlFormSchema),
    defaultValues: { url: "" },
  })

  const htmlForm = useForm<z.infer<typeof HtmlFormSchema>>({
    resolver: zodResolver(HtmlFormSchema),
    defaultValues: { html: "" },
  })
  
  const handleScrape = useCallback(async (scrapeAction: () => Promise<Property[] | null>) => {
    setIsLoading(true);
    setResults([]);
    startTransition(async () => {
      try {
        const data = await scrapeAction();
        if (data) {
          setResults(data);
          toast({ title: "Scraping Successful", description: `Found ${data.length} properties.` });
        } else {
          throw new Error("No data returned from scraping.");
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Scraping Failed",
          description: error instanceof Error ? error.message : "An unknown error occurred.",
        });
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    });
  }, [toast]);

  const onUrlSubmit = (values: z.infer<typeof UrlFormSchema>) => {
    handleScrape(() => scrapeUrl(values.url));
    urlForm.reset();
  };

  const onHtmlSubmit = (values: z.infer<typeof HtmlFormSchema>) => {
    handleScrape(() => scrapeHtml(values.html));
    htmlForm.reset();
  };

  const handleBulkSubmit = () => {
    if(!bulkUrls.trim()){
      toast({ variant: "destructive", title: "Input Error", description: "URL list cannot be empty." });
      return;
    }
    handleScrape(() => scrapeBulk(bulkUrls));
    setBulkUrls('');
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };
  
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setBulkUrls(content);
    };
    reader.onerror = () => {
      toast({ variant: "destructive", title: "File Error", description: "Failed to read the file." });
    }
    reader.readAsText(file);
  };
  
  const handleDragEvents = (e: DragEvent<HTMLDivElement>, dragging: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(dragging);
  };

  const handleSaveProperty = useCallback((property: Property) => {
    startTransition(async () => {
      try {
        await saveProperty(property);
        toast({
          title: "Property Saved",
          description: "The property has been added to your database.",
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Save Failed",
          description: "Could not save the property to the database.",
        });
      }
    });
  }, [toast]);

  return (
    <>
      <div className="w-full max-w-5xl mx-auto">
        <Tabs defaultValue="url" className="w-full">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto sm:h-10">
            <TabsTrigger value="url">Scrape by URL</TabsTrigger>
            <TabsTrigger value="html">Scrape by HTML</TabsTrigger>
            <TabsTrigger value="bulk">Bulk Scrape</TabsTrigger>
          </TabsList>

          <TabsContent value="url">
            <Form {...urlForm}>
              <form onSubmit={urlForm.handleSubmit(onUrlSubmit)} className="space-y-4 card-glass p-6 rounded-b-lg">
                <FormField
                  control={urlForm.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Property URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/property/123" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                  {isLoading ? <Loader2 className="animate-spin" /> : "Scrape URL"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="html">
            <Form {...htmlForm}>
                <form onSubmit={htmlForm.handleSubmit(onHtmlSubmit)} className="space-y-4 card-glass p-6 rounded-b-lg">
                  <FormField
                    control={htmlForm.control}
                    name="html"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>HTML Source Code</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Paste HTML source code here..." className="min-h-[200px]" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                    {isLoading ? <Loader2 className="animate-spin" /> : "Scrape HTML"}
                     <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>
            </Form>
          </TabsContent>

          <TabsContent value="bulk">
            <div className="card-glass p-6 rounded-b-lg space-y-4">
              <div 
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                  ${isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
                onDrop={handleDrop}
                onDragOver={(e) => handleDragEvents(e, true)}
                onDragEnter={(e) => handleDragEvents(e, true)}
                onDragLeave={(e) => handleDragEvents(e, false)}
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Drag & drop a .txt, .csv file with URLs here, or click to select file.
                </p>
                <input id="file-upload" type="file" className="hidden" accept=".txt,.csv" onChange={handleFileChange} />
              </div>
              <Textarea 
                placeholder="Or paste a list of URLs (one per line)" 
                className="min-h-[150px]"
                value={bulkUrls}
                onChange={(e) => setBulkUrls(e.target.value)}
              />
               <Button onClick={handleBulkSubmit} disabled={isLoading} className="w-full sm:w-auto">
                 {isLoading ? <Loader2 className="animate-spin" /> : "Start Bulk Scrape"}
                 <ArrowRight className="ml-2 h-4 w-4" />
               </Button>
            </div>
          </TabsContent>
        </Tabs>

        {(isLoading || results.length > 0) && (
          <div className="mt-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
              <h2 className="text-2xl font-bold">Scraping Results</h2>
              {results.length > 0 && !isLoading && (
                 <div className="flex gap-2">
                  <Button variant="outline" onClick={() => downloadJson(results, 'properties')}>Export JSON</Button>
                  <Button variant="outline" onClick={() => downloadCsv(results, 'properties')}>Export CSV</Button>
                  <Button variant="outline" onClick={() => downloadExcel(results, 'properties')}>Export Excel</Button>
                  <Button variant="destructive" size="sm" onClick={() => setResults([])}><Trash2 className="mr-2 h-4 w-4"/>Clear Results</Button>
                </div>
              )}
            </div>
            {isLoading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <ResultsTable 
                properties={results}
                onSave={handleSaveProperty}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}

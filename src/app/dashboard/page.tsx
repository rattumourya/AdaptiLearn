
"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatDistanceToNow } from "date-fns";
import {
  Book,
  FileText,
  Gamepad2,
  Loader2,
  PlusCircle,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Document } from "@/lib/types";
import { MOCK_DOCUMENTS, MOCK_GAMES } from "@/lib/mock-data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { customizeGameDifficulty } from "@/ai/flows/game-customization";
import { processDocument } from "@/ai/flows/process-document";


const uploadSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  text: z.string().min(100, "Please provide at least 100 characters of text."),
});

const gameCustomizationSchema = z.object({
  difficulty: z.enum(["easy", "medium", "hard"]),
});

export default function DashboardPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>(MOCK_DOCUMENTS);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [isUploadOpen, setUploadOpen] = useState(false);
  const [isGameSelectOpen, setGameSelectOpen] = useState(false);
  const [isGameCustomizeOpen, setGameCustomizeOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadForm = useForm<z.infer<typeof uploadSchema>>({
    resolver: zodResolver(uploadSchema),
    defaultValues: { title: "", text: "" },
  });

  const gameForm = useForm<z.infer<typeof gameCustomizationSchema>>({
    resolver: zodResolver(gameCustomizationSchema),
    defaultValues: { difficulty: "medium" },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          uploadForm.setValue('text', text);
          if (!uploadForm.getValues('title')) {
            uploadForm.setValue('title', file.name.replace(/\.[^/.]+$/, ""));
          }
        };
        reader.readAsText(file);
      } else {
        toast({
          title: "Unsupported File Type",
          description: "Please upload a .txt file for now. PDF and other formats are not yet supported.",
          variant: "destructive",
        });
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    }
  };

  const handleUploadSubmit = async (values: z.infer<typeof uploadSchema>) => {
    setIsProcessing(true);
    toast({
      title: "Processing document...",
      description: "Our AI is analyzing your text to extract vocabulary.",
    });

    try {
      // The processDocument flow is now primarily for validation and future complex processing.
      // The game customization flow will handle the main logic.
      await processDocument({ documentText: values.text });

      const newDoc: Document = {
        id: `doc-${Date.now()}`,
        title: values.title,
        createdAt: new Date().toISOString(),
        content: values.text,
      };
      setDocuments((prev) => [newDoc, ...prev]);
      uploadForm.reset();
      setUploadOpen(false);
      toast({
        title: "Success!",
        description: `Your document "${values.title}" has been added.`,
        variant: "default",
      });
    } catch (error) {
      console.error("Error processing document:", error);
      toast({
        title: "Upload Failed",
        description: (error as Error).message || "There was an error processing your document.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleDeleteDocument = (docId: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== docId));
    toast({
        title: "Document Removed",
        description: "The selected document has been removed from your library.",
    });
  };

  const handleGameCustomizeSubmit = async (
    values: z.infer<typeof gameCustomizationSchema>
  ) => {
    if (!selectedDoc || !selectedGame) return;
    setIsProcessing(true);
    toast({
      title: "Customizing game...",
      description: `Generating a new ${selectedGame.name} game for you. This may take a moment.`,
    });
    try {
      const gameData = await customizeGameDifficulty({
        documentText: selectedDoc.content,
        gameType: selectedGame.name,
        desiredDifficulty: values.difficulty,
      });
      console.log("Customized Game Parameters:", gameData);
      
      sessionStorage.setItem('currentGameData', JSON.stringify(gameData));
      // Set document context for hint generation
      sessionStorage.setItem('game_document_content', selectedDoc.content);
      
      router.push(`/game`);

    } catch (error) {
      console.error("Error customizing game:", error);
      toast({
        title: "Customization Failed",
        description: (error as Error).message || "Could not generate a custom game. Please try again.",
        variant: "destructive",
      });
    } finally {
       setIsProcessing(false);
       setGameCustomizeOpen(false);
    } 
  };

  const openGameSelection = (doc: Document) => {
    setSelectedDoc(doc);
    setGameSelectOpen(true);
  };

  const openGameCustomization = (game: Game) => {
    setSelectedGame(game);
    setGameCustomizeOpen(true);
    setGameSelectOpen(false);
  };

  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">My Library</h1>
          <p className="text-muted-foreground">
            Your personal collection of documents for learning.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-6">
        {documents.map((doc) => (
          <Card key={doc.id} className="relative group">
            <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-2 right-2 h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDeleteDocument(doc.id)}
            >
                <X className="h-4 w-4"/>
                <span className="sr-only">Delete document</span>
            </Button>
            <CardHeader>
              <div className="flex items-start justify-between">
                <FileText className="h-8 w-8 text-primary" />
                <Badge variant="outline">
                  {formatDistanceToNow(new Date(doc.createdAt), {
                    addSuffix: true,
                  })}
                </Badge>
              </div>
              <CardTitle className="font-headline pt-4">{doc.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-3">
                {doc.content}
              </p>
            </CardContent>
            <CardFooter>
              <Button className="w-full" onClick={() => openGameSelection(doc)}>
                <Gamepad2 className="mr-2 h-4 w-4" />
                Play Games
              </Button>
            </CardFooter>
          </Card>
        ))}
         <Dialog open={isUploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
             <Card className="flex cursor-pointer items-center justify-center border-2 border-dashed bg-transparent transition-all hover:shadow-lg">
                <div className="flex flex-col items-center p-8 text-center">
                    <PlusCircle className="h-12 w-12 text-muted-foreground" />
                    <span className="mt-2 text-sm font-medium text-muted-foreground">Add New Document</span>
                </div>
            </Card>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[625px]">
            <DialogHeader>
              <DialogTitle className="font-headline">Add New Document</DialogTitle>
              <DialogDescription>
                Upload a file or paste text to create a new learning set.
              </DialogDescription>
            </DialogHeader>
            <Form {...uploadForm}>
              <form onSubmit={uploadForm.handleSubmit(handleUploadSubmit)} className="space-y-4">
                <div className="space-y-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                      accept=".txt"
                      disabled={isProcessing}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={isProcessing}
                      onClick={() => fileInputRef.current?.click()}
                    >
                        <UploadCloud className="mr-2 h-4 w-4"/> Upload File (.txt)
                    </Button>
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-2 text-muted-foreground">Or Paste Text</span>
                        </div>
                    </div>
                </div>
                <FormField
                  control={uploadForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Biology Chapter 5" {...field} disabled={isProcessing}/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={uploadForm.control}
                  name="text"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Paste your document content here..."
                          className="min-h-[200px]"
                          {...field}
                          disabled={isProcessing}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={isProcessing}>
                    {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Sparkles className="mr-2 h-4 w-4"/>
                    Process with AI
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Game Selection Modal */}
      <Dialog open={isGameSelectOpen} onOpenChange={setGameSelectOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle className="font-headline">Select a Game</DialogTitle>
            <DialogDescription>
              Choose a game to play with words from "{selectedDoc?.title}".
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] p-1">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 p-4">
              {MOCK_GAMES.map((game) => (
                <Card
                  key={game.id}
                  className="flex cursor-pointer flex-col transition-all hover:shadow-lg hover:-translate-y-1"
                  onClick={() => openGameCustomization(game)}
                >
                  <CardHeader>
                    <CardTitle className="font-headline text-lg">{game.name}</CardTitle>
                    <div className="flex flex-wrap gap-1 pt-2">
                        {game.improves.map(skill => <Badge key={skill} variant="secondary">{skill}</Badge>)}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground">{game.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      
      {/* Game Customization Modal */}
      <Dialog open={isGameCustomizeOpen} onOpenChange={setGameCustomizeOpen}>
        <DialogContent>
           <DialogHeader>
            <DialogTitle className="font-headline">Customize Your Game</DialogTitle>
            <DialogDescription>
              Adjust the settings for your game of <span className="font-semibold text-primary">{selectedGame?.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <Form {...gameForm}>
            <form onSubmit={gameForm.handleSubmit(handleGameCustomizeSubmit)} className="space-y-6 pt-4">
               <FormField
                  control={gameForm.control}
                  name="difficulty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Difficulty Level</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isProcessing}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a difficulty" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="easy">Easy</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                       <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" onClick={() => setGameCustomizeOpen(false)} disabled={isProcessing}>
                            Cancel
                        </Button>
                    </DialogClose>
                    <Button type="submit" disabled={isProcessing}>
                        {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Start Playing
                    </Button>
                </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

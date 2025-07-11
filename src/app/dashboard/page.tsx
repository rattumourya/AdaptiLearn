
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatDistanceToNow } from "date-fns";
import {
  FileText,
  Gamepad2,
  Loader2,
  PlusCircle,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

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
  DialogClose,
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
import type { Document, Game } from "@/lib/types";
import { MOCK_GAMES } from "@/lib/mock-data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { customizeGameDifficulty } from "@/ai/flows/game-customization";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";

const uploadSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  text: z.string().min(100, "Please provide at least 100 characters of text."),
});

const gameCustomizationSchema = z.object({
  difficulty: z.enum(["easy", "medium", "hard"]),
});

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [isUploadOpen, setUploadOpen] = useState(false);
  const [isGameSelectOpen, setGameSelectOpen] = useState(false);
  const [isGameCustomizeOpen, setGameCustomizeOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
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

  useEffect(() => {
    if (user) {
      setIsLoadingDocs(true);
      const docsRef = collection(db, "documents");
      const q = query(
        docsRef,
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );

      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          const userDocs = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Document[];
          setDocuments(userDocs);
          setIsLoadingDocs(false);
        },
        (error) => {
          console.error("Error fetching documents:", error);
          toast({
            title: "Error",
            description: "Could not fetch your documents.",
            variant: "destructive",
          });
          setIsLoadingDocs(false);
        }
      );

      return () => unsubscribe();
    }
  }, [user, toast]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === "text/plain") {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          uploadForm.setValue("text", text);
          if (!uploadForm.getValues("title")) {
            uploadForm.setValue("title", file.name.replace(/\.[^/.]+$/, ""));
          }
        };
        reader.readAsText(file);
      } else {
        toast({
          title: "Unsupported File Type",
          description: "Please upload a .txt file.",
          variant: "destructive",
        });
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    }
  };

  const handleUploadSubmit = async (values: z.infer<typeof uploadSchema>) => {
    if (!user) {
      toast({
        title: "Not authenticated",
        description: "You must be logged in to add a document.",
        variant: "destructive",
      });
      return;
    }
    setIsProcessing(true);
    const { id: toastId } = toast({
      title: "Processing document...",
      description: "Saving your document to the cloud.",
    });

    try {
      await addDoc(collection(db, "documents"), {
        userId: user.uid,
        title: values.title,
        content: values.text,
        createdAt: serverTimestamp(),
      });

      uploadForm.reset();
      setUploadOpen(false);
      toast({
        id: toastId,
        title: "Success!",
        description: `Your document "${values.title}" has been added.`,
        variant: "default",
      });
    } catch (error) {
      console.error("Error adding document:", error);
      toast({
        id: toastId,
        title: "Upload Failed",
        description: (error as Error).message || "There was an error saving your document.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    setDeletingDocId(docId);
    try {
      await deleteDoc(doc(db, "documents", docId));
      toast({
        title: "Document Removed",
        description: "The selected document has been removed.",
      });
    } catch (error) {
      console.error("Error deleting document:", error);
      toast({
        title: "Deletion Failed",
        description: "Could not remove the document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingDocId(null);
    }
  };

  const handleGameCustomizeSubmit = async (
    values: z.infer<typeof gameCustomizationSchema>
  ) => {
    if (!selectedDoc || !selectedGame) return;
    setIsProcessing(true);
    const { id: toastId, dismiss } = toast({
      title: "Customizing game...",
      description: `Generating a new ${selectedGame.name} game for you. This may take a moment.`,
    });
    try {
      const gameData = await customizeGameDifficulty({
        documentText: selectedDoc.content,
        gameType: selectedGame.name,
        desiredDifficulty: values.difficulty,
      });

      sessionStorage.setItem("currentGameData", JSON.stringify(gameData));
      sessionStorage.setItem("game_document_content", selectedDoc.content);

      if (user) {
        await addDoc(collection(db, "gameResults"), {
          userId: user.uid,
          documentId: selectedDoc.id,
          gameType: selectedGame.name,
          difficulty: values.difficulty,
          status: "started",
          score: 0,
          startedAt: serverTimestamp(),
        });
      }
      
      dismiss(toastId);
      router.push(`/game`);

    } catch (error) {
      console.error("Error customizing game:", error);
      toast({
        id: toastId,
        title: "Customization Failed",
        description:
          (error as Error).message ||
          "Could not generate a custom game. Please try again.",
        variant: "destructive",
      });
      setIsProcessing(false);
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

  if (authLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
        {isLoadingDocs && Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-8 w-24" /></CardHeader>
            <CardContent><Skeleton className="h-16 w-full" /></CardContent>
            <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
          </Card>
        ))}

        {!isLoadingDocs && documents.map((doc) => (
          <Card key={doc.id} className="relative group">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
              onClick={() => handleDeleteDocument(doc.id)}
              disabled={deletingDocId === doc.id}
            >
              {deletingDocId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              <span className="sr-only">Delete document</span>
            </Button>
            <CardHeader>
              <div className="flex items-start justify-between">
                <FileText className="h-8 w-8 text-primary" />
                {doc.createdAt && (
                  <Badge variant="outline">
                    {formatDistanceToNow(
                      (doc.createdAt as any).toDate
                        ? (doc.createdAt as any).toDate()
                        : new Date(doc.createdAt as string),
                      { addSuffix: true }
                    )}
                  </Badge>
                )}
              </div>
              <CardTitle className="pt-4">{doc.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-3">
                {doc.content}
              </p>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={() => openGameSelection(doc)}
              >
                <Gamepad2 className="mr-2" />
                Play Games
              </Button>
            </CardFooter>
          </Card>
        ))}

        {!isLoadingDocs && (
          <Dialog open={isUploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Card className="flex cursor-pointer items-center justify-center border-2 border-dashed bg-transparent transition-all hover:shadow-lg">
                <div className="flex flex-col items-center p-8 text-center">
                  <PlusCircle className="h-12 w-12 text-muted-foreground" />
                  <span className="mt-2 text-sm font-medium text-muted-foreground">
                    Add New Document
                  </span>
                </div>
              </Card>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[625px]">
              <DialogHeader>
                <DialogTitle>Add New Document</DialogTitle>
                <DialogDescription>
                  Upload a file or paste text to create a new learning set.
                </DialogDescription>
              </DialogHeader>
              <Form {...uploadForm}>
                <form
                  onSubmit={uploadForm.handleSubmit(handleUploadSubmit)}
                  className="space-y-4"
                >
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
                      <UploadCloud className="mr-2" /> Upload File (.txt)
                    </Button>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">
                          Or Paste Text
                        </span>
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
                          <Input
                            placeholder="e.g., Biology Chapter 5"
                            {...field}
                            disabled={isProcessing}
                          />
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
                      {isProcessing && (
                        <Loader2 className="mr-2 animate-spin" />
                      )}
                      <Sparkles className="mr-2" />
                      Process with AI
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Game Selection Modal */}
      <Dialog open={isGameSelectOpen} onOpenChange={setGameSelectOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Select a Game</DialogTitle>
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
                    <CardTitle>{game.name}</CardTitle>
                    <div className="flex flex-wrap gap-1 pt-2">
                      {game.improves.map((skill) => (
                        <Badge key={skill} variant="secondary">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground">
                      {game.description}
                    </p>
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
            <DialogTitle>Customize Your Game</DialogTitle>
            <DialogDescription>
              Adjust the settings for your game of{" "}
              <span className="font-semibold text-primary">
                {selectedGame?.name}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <Form {...gameForm}>
            <form
              onSubmit={gameForm.handleSubmit(handleGameCustomizeSubmit)}
              className="space-y-6 pt-4"
            >
              <FormField
                control={gameForm.control}
                name="difficulty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Difficulty Level</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isProcessing}
                    >
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setGameCustomizeOpen(false)}
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isProcessing}>
                  {isProcessing && <Loader2 className="mr-2 animate-spin" />}
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

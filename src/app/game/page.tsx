"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { MOCK_GAMES, MOCK_DOCUMENTS } from "@/lib/mock-data";
import { generateHint } from "@/ai/flows/generate-hint";
import { customizeGameDifficulty } from "@/ai/flows/game-customization";
import { Loader2, Lightbulb, CheckCircle, XCircle, ChevronLeft } from "lucide-react";
import type { Game } from "@/lib/types";

function GameComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [game, setGame] = useState<Game | null>(null);
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const [documentContent, setDocumentContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [gameData, setGameData] = useState<any>(null); // To store customized game params
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [isHintLoading, setIsHintLoading] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    const gameId = searchParams.get("gameId");
    const docId = searchParams.get("docId");
    const difficultyParam = searchParams.get("difficulty");

    if (!gameId || !docId || !difficultyParam) {
      setError("Missing game information. Please go back and select a game.");
      setIsLoading(false);
      return;
    }

    const foundGame = MOCK_GAMES.find((g) => g.id === gameId);
    const content = sessionStorage.getItem('game_document_content');

    if (!foundGame || !content) {
      setError("Could not find the selected game or document.");
      setIsLoading(false);
      return;
    }

    setGame(foundGame);
    setDifficulty(difficultyParam);
    setDocumentContent(content);

    const fetchGameData = async () => {
      try {
        const result = await customizeGameDifficulty({
          documentText: content,
          gameType: foundGame.name,
          desiredDifficulty: difficultyParam as "easy" | "medium" | "hard",
        });
        // The AI returns a string, so we need to parse it.
        // A more robust solution would be to ask the AI for JSON.
        const parsedData = {
          words: result.customizedParameters
            .split(",")
            .map((w) => w.trim()),
        };
        setGameData(parsedData);
      } catch (err) {
        console.error("Failed to customize game:", err);
        setError("Failed to generate the game. Please try again.");
        toast({
          title: "Error",
          description: "Could not create a customized game.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchGameData();
  }, [searchParams, toast]);

  const handleGetHint = async () => {
    if (!gameData || !documentContent) return;
    setIsHintLoading(true);
    try {
      const currentWord = gameData.words[currentWordIndex];
      const result = await generateHint({
        documentContext: documentContent,
        word: currentWord,
      });
      toast({
        title: "Hint",
        description: result.hint,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Could not fetch a hint.",
        variant: "destructive",
      });
    } finally {
      setIsHintLoading(false);
    }
  };

  const handleSubmitAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameData) return;

    const currentWord = gameData.words[currentWordIndex];
    const correct = userAnswer.toLowerCase() === currentWord.toLowerCase();
    setIsCorrect(correct);
    if (correct) {
      setScore(score + 1);
    }

    setTimeout(() => {
      setIsCorrect(null);
      setUserAnswer("");
      if (currentWordIndex < gameData.words.length - 1) {
        setCurrentWordIndex(currentWordIndex + 1);
      } else {
        setIsFinished(true);
      }
    }, 1500);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading your game...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button onClick={() => router.push('/dashboard')} className="mt-4">Go to Dashboard</Button>
        </Alert>
      </div>
    );
  }

  if (isFinished) {
    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <CardTitle className="font-headline text-3xl">Game Over!</CardTitle>
                    <CardDescription>You've completed the game.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-xl">Your final score is:</p>
                    <p className="text-5xl font-bold text-primary my-4">{score} / {gameData.words.length}</p>
                    <Progress value={(score / gameData.words.length) * 100} className="mt-4" />
                </CardContent>
                <CardFooter>
                    <Button onClick={() => router.push('/dashboard')} className="w-full">
                        Back to Dashboard
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
  }

  return (
    <div className="container mx-auto max-w-2xl py-8">
       <Button variant="ghost" onClick={() => router.push('/dashboard')} className="mb-4">
            <ChevronLeft className="mr-2 h-4 w-4"/>
            Back to Library
        </Button>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
                <CardTitle className="font-headline text-3xl">{game?.name}</CardTitle>
                <CardDescription>A custom game based on your document.</CardDescription>
            </div>
            <Badge variant="secondary" className="capitalize">{difficulty}</Badge>
          </div>
          <Progress value={((currentWordIndex + 1) / (gameData?.words?.length || 1)) * 100} className="mt-4" />
        </CardHeader>
        <CardContent className="text-center">
            <div className="my-8">
                <p className="text-muted-foreground mb-2">What is this word?</p>
                <p className="text-4xl font-bold tracking-widest uppercase blur-sm select-none">
                    {gameData?.words[currentWordIndex]}
                </p>
                <p className="text-sm text-muted-foreground mt-2">Unscramble the letters to find the word.</p>
            </div>
          <form onSubmit={handleSubmitAnswer}>
            <div className="relative">
              <Input
                type="text"
                placeholder="Type your answer here..."
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                className={`text-center text-lg h-12 ${
                    isCorrect === true ? 'border-green-500 focus-visible:ring-green-500' : ''
                } ${
                    isCorrect === false ? 'border-red-500 focus-visible:ring-red-500' : ''
                }`}
                disabled={isCorrect !== null}
              />
              {isCorrect === true && <CheckCircle className="absolute right-3 top-3 h-6 w-6 text-green-500" />}
              {isCorrect === false && <XCircle className="absolute right-3 top-3 h-6 w-6 text-red-500" />}
            </div>
            <Button type="submit" className="mt-4 w-full" disabled={isCorrect !== null}>
                Submit
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-between">
            <p className="text-sm text-muted-foreground">Score: {score}</p>
            <Button variant="outline" onClick={handleGetHint} disabled={isHintLoading}>
                {isHintLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Lightbulb className="mr-2 h-4 w-4"/>}
                Get a Hint
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}


export default function GamePage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <GameComponent />
        </Suspense>
    )
}

    

"use client";

import { useEffect, useState, Suspense, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { generateHint } from "@/ai/flows/generate-hint";
import type { CustomizeGameDifficultyOutput } from "@/ai/flows/game-customization";
import {
  Loader2,
  Lightbulb,
  Check,
  X,
  ChevronLeft,
  Eye,
  Timer,
  Heart,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";


// Fisher-Yates shuffle algorithm
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

function GameComponent() {
  const router = useRouter();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [gameData, setGameData] = useState<CustomizeGameDifficultyOutput | null>(null);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [isHintLoading, setIsHintLoading] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  // Time-limited session state
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes (300 seconds)
  const [lives, setLives] = useState(5);
  const [streak, setStreak] = useState(0);
  const [gameResultId, setGameResultId] = useState<string | null>(null);

  useEffect(() => {
    const storedGameData = sessionStorage.getItem("currentGameData");
    const storedResultId = sessionStorage.getItem("currentGameResultId");

    if (!storedGameData) {
      setError("Could not load game data. Please start a new game from the dashboard.");
      setIsLoading(false);
      return;
    }
    setGameResultId(storedResultId);

    try {
      const parsedGameData: CustomizeGameDifficultyOutput = JSON.parse(storedGameData);
      if (!parsedGameData.gameData || parsedGameData.gameData.length === 0) {
        setError("The generated game is empty. Please try again.");
        setIsLoading(false);
        return;
      }
      setGameData(parsedGameData);
      setIsLoading(false);
    } catch (err) {
      console.error("Failed to parse game data from sessionStorage:", err);
      setError("Failed to load the game. The data might be corrupted. Please try again.");
      setIsLoading(false);
    }
  }, []);

  const finishGame = useCallback(async () => {
      setIsFinished(true);
      if (gameResultId) {
          try {
              const gameResultRef = doc(db, "gameResults", gameResultId);
              await updateDoc(gameResultRef, {
                  score: score,
                  status: "completed",
                  completedAt: serverTimestamp(),
              });
          } catch (error) {
              console.error("Failed to save game results:", error);
              toast({
                title: "Sync Error",
                description: "Could not save your final score.",
                variant: "destructive"
              });
          }
      }
  }, [gameResultId, score, toast]);

  useEffect(() => {
    if (isLoading || isFinished) return;
    if (timeLeft > 0 && lives > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (!isFinished) {
      finishGame();
    }
  }, [timeLeft, lives, isLoading, isFinished, finishGame]);


  const advanceToNextRound = useCallback((delay: number) => {
    if (lives <= 0 || timeLeft <= 1) {
        finishGame();
        return;
    }
    setTimeout(() => {
      const nextRoundIndex = currentRoundIndex + 1;
      if (nextRoundIndex >= (gameData?.gameData.length || 0)) {
        finishGame();
        return;
      }
      setIsCorrect(null);
      setUserAnswer("");
      setCurrentRoundIndex(nextRoundIndex);
    }, delay);
  }, [currentRoundIndex, gameData, lives, timeLeft, finishGame]);

  const handleCorrectAnswer = useCallback((points = 10) => {
    const streakBonus = streak * 2;
    setScore(prev => prev + points + streakBonus);
    setStreak(prev => prev + 1);
    setIsCorrect(true);
    advanceToNextRound(1200);
  }, [streak, advanceToNextRound]);

  const handleIncorrectAnswer = useCallback(() => {
    const newLives = lives - 1;
    setLives(newLives);
    setStreak(0);
    setIsCorrect(false);
    
    if (newLives <= 0) {
        setTimeout(() => finishGame(), 1500);
    } else {
        advanceToNextRound(1500);
    }
  }, [lives, advanceToNextRound, finishGame]);

  const handleSubmitAnswer = (e: React.FormEvent | string) => {
    if (typeof e !== 'string') e.preventDefault();
    if (!gameData || isCorrect !== null) return;
    
    const submittedAnswer = (typeof e === 'string' ? e : userAnswer).trim().toLowerCase();
    if (!submittedAnswer) return;

    const currentRound = gameData.gameData[currentRoundIndex];
    let isAnswerCorrect = false;

    switch (currentRound.miniGameType) {
        case 'word-translation-match':
             isAnswerCorrect = submittedAnswer === currentRound.correctTranslation.toLowerCase();
             break;
        case 'word-image-match':
            isAnswerCorrect = submittedAnswer === currentRound.word.toLowerCase();
            break;
        case 'spelling-completion':
            isAnswerCorrect = submittedAnswer === currentRound.word.toLowerCase();
            break;
        case 'trace-or-type':
            isAnswerCorrect = submittedAnswer === currentRound.word.toLowerCase();
            break;
        case 'true-false-challenge':
            const expected = currentRound.isCorrectMatch ? 'true' : 'false';
            isAnswerCorrect = submittedAnswer === expected;
            break;
    }

    if (isAnswerCorrect) {
        handleCorrectAnswer();
    } else {
        handleIncorrectAnswer();
    }
  };

  const handleGetHint = async () => {
    if (!gameData) return;
    setIsHintLoading(true);

    const currentRound = gameData.gameData[currentRoundIndex];
    const documentContent = sessionStorage.getItem("game_document_content") || "No context available.";

    try {
      const result = await generateHint({
        documentContext: documentContent,
        word: currentRound.word,
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

  const handleRevealAnswer = () => {
    if (!gameData || isCorrect !== null) return;
    let correctAnswer = 'N/A';
    const currentRound = gameData.gameData[currentRoundIndex];
    
    switch(currentRound.miniGameType) {
        case 'word-translation-match': correctAnswer = currentRound.correctTranslation; break;
        case 'word-image-match': correctAnswer = currentRound.word; break;
        case 'spelling-completion': correctAnswer = currentRound.word; break;
        case 'trace-or-type': correctAnswer = currentRound.word; break;
        case 'true-false-challenge': correctAnswer = `The statement was ${currentRound.isCorrectMatch}`; break;
    }

    toast({
      title: 'Answer Revealed',
      description: `The correct answer was: ${correctAnswer}`,
    });
    handleIncorrectAnswer();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>Error Loading Game</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button onClick={() => router.push("/dashboard")} className="mt-4">
            Back to Dashboard
          </Button>
        </Alert>
      </div>
    );
  }
  
  if (isFinished || !gameData) {
    const finalMessage = lives <= 0 ? "You ran out of lives!" : timeLeft <= 0 ? "Time's up!" : "Congratulations!";
    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <CardTitle className="font-headline text-3xl">Session Complete!</CardTitle>
                    <CardDescription>{finalMessage}</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-xl">Your final score is:</p>
                    <p className="text-5xl font-bold text-primary my-4">{score}</p>
                    <div className="text-sm text-muted-foreground">
                        <p>Rounds completed: {currentRoundIndex} / {gameData?.gameData.length}</p>
                    </div>
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

  const currentRound = gameData.gameData[currentRoundIndex];
  const progressValue = ((currentRoundIndex + 1) / gameData.gameData.length) * 100;

  const renderGameHeader = () => (
    <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="font-headline text-3xl">{gameData.gameTitle}</CardTitle>
            <CardDescription>A 5-minute learning burst!</CardDescription>
          </div>
          <div className="flex items-center gap-4 text-lg">
             <div className="flex items-center gap-1.5 text-rose-500 font-semibold">
                  <Heart className="w-6 h-6"/>
                  <span>{lives}</span>
             </div>
             <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
                 <Timer className="w-6 h-6"/>
                 <span>{Math.floor(timeLeft / 60)}:{('0' + timeLeft % 60).slice(-2)}</span>
             </div>
          </div>
        </div>
        <Progress value={progressValue} className="mt-4 h-2" />
    </CardHeader>
  );

  function CurrentRoundComponent() {
    const feedbackClass = isCorrect === true ? 'ring-green-500' : isCorrect === false ? 'ring-red-500' : 'ring-transparent';

    const shuffledWordOptions = useMemo(() => {
        if (currentRound.miniGameType === 'word-image-match') {
            return shuffleArray([currentRound.word, ...currentRound.distractorWords]);
        }
        return [];
    }, [currentRound]);

    const shuffledTranslationOptions = useMemo(() => {
        if (currentRound.miniGameType === 'word-translation-match') {
            const options = [currentRound.correctTranslation, ...currentRound.distractorTranslations];
            return shuffleArray(options);
        }
        return [];
    }, [currentRound]);

    return (
        <CardContent className={cn("min-h-[350px] flex flex-col items-center justify-center p-4 transition-all")}>
            <div className={cn("w-full text-center p-4 rounded-lg ring-4 transition-all", feedbackClass)}>
                <p className="font-semibold text-lg mb-4">{currentRound.displayPrompt}</p>

                {currentRound.miniGameType === 'word-image-match' && (
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative w-48 h-48 mb-4">
                           <Image src={currentRound.imageDataUri} alt={currentRound.word} layout="fill" className="rounded-md object-cover" data-ai-hint="object concept"/>
                        </div>
                        <div className="grid grid-cols-2 gap-4 w-full">
                           {shuffledWordOptions.map(word => (
                               <Button key={word} variant="outline" className="h-16 text-base" onClick={() => handleSubmitAnswer(word)} disabled={isCorrect !== null}>
                                   {word}
                               </Button>
                           ))}
                        </div>
                    </div>
                )}
                
                {currentRound.miniGameType === 'word-translation-match' && (
                    <div className="flex flex-col items-center gap-4">
                        <p className="text-4xl font-bold my-4">{currentRound.word}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                            {shuffledTranslationOptions.map(translation => (
                                <Button key={translation} variant="outline" className="h-16 text-base" onClick={() => handleSubmitAnswer(translation)} disabled={isCorrect !== null}>
                                    {translation}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}
                
                {(currentRound.miniGameType === 'spelling-completion' || currentRound.miniGameType === 'trace-or-type') && (
                    <>
                        <p className="text-4xl font-bold tracking-widest my-8 uppercase">{currentRound.miniGameType === 'spelling-completion' ? currentRound.promptWord : currentRound.word}</p>
                        <form onSubmit={(e) => handleSubmitAnswer(e)} className="flex flex-col items-center gap-4 w-full">
                            <Input
                                value={userAnswer}
                                onChange={(e) => setUserAnswer(e.target.value)}
                                placeholder="Type the full word..."
                                className="text-center text-lg h-12 max-w-sm"
                                disabled={isCorrect !== null}
                                autoFocus
                            />
                            <Button type="submit" className="w-full max-w-sm" disabled={isCorrect !== null}>Submit</Button>
                        </form>
                    </>
                )}
                
                {currentRound.miniGameType === 'true-false-challenge' && (
                    <div className="flex flex-col items-center gap-6">
                        <Card className="p-4">
                            <p className="text-2xl font-bold">{currentRound.word}</p>
                            <p className="text-muted-foreground">is</p>
                            <p className="text-2xl font-bold">{currentRound.imageOrTranslation}</p>
                        </Card>
                        <div className="flex gap-4">
                            <Button className="h-16 w-32 text-lg bg-green-100 hover:bg-green-200 text-green-800" onClick={() => handleSubmitAnswer('true')} disabled={isCorrect !== null}>
                                <Check className="mr-2"/> True
                            </Button>
                            <Button className="h-16 w-32 text-lg bg-red-100 hover:bg-red-200 text-red-800" onClick={() => handleSubmitAnswer('false')} disabled={isCorrect !== null}>
                                <X className="mr-2"/> False
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </CardContent>
    );
  };


  return (
    <div className="container mx-auto max-w-2xl py-8">
      <Button variant="ghost" onClick={() => router.push("/dashboard")} className="mb-4">
        <ChevronLeft className="mr-2 h-4 w-4" />
        Back to Library
      </Button>
      <Card>
        {renderGameHeader()}
        <CurrentRoundComponent />
        <CardFooter className="flex justify-between items-center">
            <div className="flex items-center gap-2">
                 <p className="text-sm text-muted-foreground">Score: <span className="font-bold">{score}</span></p>
                 <p className="text-sm text-muted-foreground flex items-center">
                    Streak: <span className="font-bold ml-1">{streak}x</span> <Sparkles className="w-4 h-4 ml-1 text-yellow-500"/>
                 </p>
            </div>
             <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleRevealAnswer} disabled={isCorrect !== null}>
                    <Eye className="mr-2 h-4 w-4" /> Reveal
                </Button>
                <Button variant="outline" size="sm" onClick={handleGetHint} disabled={isHintLoading || isCorrect !== null}>
                    {isHintLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Lightbulb className="mr-2 h-4 w-4"/>}
                    Hint
                </Button>
            </div>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-16 w-16 animate-spin text-primary" /></div>}>
      <GameComponent />
    </Suspense>
  );
}

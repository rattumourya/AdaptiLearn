
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
  const [revealedAnswer, setRevealedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [isHintLoading, setIsHintLoading] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  // Time-limited session state
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes (300 seconds)
  const [lives, setLives] = useState(5);
  const [streak, setStreak] = useState(0);
  const [gameResultId, setGameResultId] = useState<string | null>(null);

  // --- Game-specific state ---
  // Formula Scramble
  const [formulaAnswerParts, setFormulaAnswerParts] = useState<string[]>([]);
  const [formulaOptionParts, setFormulaOptionParts] = useState<string[]>([]);
  // Timeline Teaser
  const [timelineAnswerOrder, setTimelineAnswerOrder] = useState<string[]>([]);
  const [timelineOptionItems, setTimelineOptionItems] = useState<string[]>([]);


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
      // Initialize first round state
      const firstRound = parsedGameData.gameData[0];
      if (firstRound.miniGameType === 'formula-scramble') {
        setFormulaOptionParts(shuffleArray(firstRound.scrambledParts));
      } else if (firstRound.miniGameType === 'timeline-teaser') {
        setTimelineOptionItems(shuffleArray(firstRound.scrambledOrder));
      }

      setIsLoading(false);
    } catch (err) {
      console.error("Failed to parse game data from sessionStorage:", err);
      setError("Failed to load the game. The data might be corrupted. Please try again.");
      setIsLoading(false);
    }
  }, []);

  const finishGame = useCallback(async () => {
      if (isFinished) return; // Prevent multiple calls
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
  }, [gameResultId, score, toast, isFinished]);

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
      const nextRound = gameData!.gameData[nextRoundIndex];
      setIsCorrect(null);
      setUserAnswer("");
      setRevealedAnswer(null);
      
      // Reset all game-specific states
      setFormulaAnswerParts([]);
      setTimelineAnswerOrder([]);
      setFormulaOptionParts([]);
      setTimelineOptionItems([]);

      // Initialize state for the next round
      if(nextRound.miniGameType === 'formula-scramble') {
        setFormulaOptionParts(shuffleArray(nextRound.scrambledParts));
      } else if (nextRound.miniGameType === 'timeline-teaser') {
        setTimelineOptionItems(shuffleArray(nextRound.scrambledOrder));
      }

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
  
  const getCorrectAnswerForRound = (round: any) => {
    switch (round.miniGameType) {
        case 'word-translation-match': return round.correctTranslation;
        case 'word-image-match': return round.word;
        case 'spelling-completion': return round.word;
        case 'trace-or-type': return round.word;
        case 'true-false-challenge': return round.isCorrect ? 'True' : 'False';
        case 'formula-scramble': return round.correctFormula;
        case 'timeline-teaser': return round.correctOrder.join(' → ');
        default: return '';
    }
  }

  const handleIncorrectAnswer = useCallback(() => {
    const newLives = lives - 1;
    setLives(newLives);
    setStreak(0);
    setIsCorrect(false);
    if(gameData) {
        const correct = getCorrectAnswerForRound(gameData.gameData[currentRoundIndex]);
        setRevealedAnswer(correct);
    }
    
    if (newLives <= 0) {
        setTimeout(() => finishGame(), 2500);
    } else {
        advanceToNextRound(2500);
    }
  }, [lives, advanceToNextRound, finishGame, gameData, currentRoundIndex]);

  const handleSubmitAnswer = (e: React.FormEvent | string) => {
    if (typeof e !== 'string') e.preventDefault();
    if (!gameData || isCorrect !== null) return;
    
    let submittedAnswer = (typeof e === 'string' ? e : userAnswer).trim().toLowerCase();
    if (!submittedAnswer && currentRound.miniGameType !== 'timeline-teaser' && currentRound.miniGameType !== 'formula-scramble') return;

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
        case 'trace-or-type':
            isAnswerCorrect = submittedAnswer === currentRound.word.toLowerCase();
            break;
        case 'true-false-challenge':
            const expected = currentRound.isCorrect ? 'true' : 'false';
            isAnswerCorrect = submittedAnswer === expected;
            break;
        case 'formula-scramble':
            const assembledFormula = formulaAnswerParts.join('').replace(/\s/g, '');
            isAnswerCorrect = assembledFormula.toLowerCase() === currentRound.correctFormula.replace(/\s/g, '').toLowerCase();
            break;
        case 'timeline-teaser':
            const isOrderCorrect = JSON.stringify(timelineAnswerOrder) === JSON.stringify(currentRound.correctOrder);
            isAnswerCorrect = isOrderCorrect;
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
        word: currentRound.word || currentRound.correctFormula || "the current topic",
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
    setStreak(0);
    const correctAnswer = getCorrectAnswerForRound(gameData.gameData[currentRoundIndex]);

    toast({
      title: 'Answer Revealed',
      description: `The correct answer was: ${correctAnswer}`,
    });
    handleIncorrectAnswer();
  };
  
  // Generic function for sortable games (Formula, Timeline)
  const handleSortableItemClick = (
    part: string, 
    source: 'options' | 'answer', 
    sourceList: string[], 
    setSourceList: (list: string[]) => void, 
    destList: string[], 
    setDestList: (list: string[]) => void
  ) => {
      if (isCorrect !== null) return;
      if (source === 'options') {
        // Move from options to answer
        setDestList([...destList, part]);
        setSourceList(sourceList.filter(p => p !== part));
      } else {
        // Move from answer back to options
        setSourceList([...sourceList, part]);
        setDestList(destList.filter(p => p !== part));
      }
  }


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
            <CardDescription>{gameData.gameType} Session</CardDescription>
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
                
                {isCorrect === false && revealedAnswer && (
                    <div className="mb-4 p-3 rounded-md bg-red-100 text-red-800 font-semibold">
                        Correct answer: {revealedAnswer}
                    </div>
                )}

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
                        <Card className="p-4 bg-muted/50 w-full">
                           <p className="text-lg">{currentRound.statement}</p>
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

                {currentRound.miniGameType === 'formula-scramble' && (
                    <div className="flex flex-col items-center gap-4 w-full">
                        {/* Answer Drop Zone */}
                        <div className="w-full p-4 min-h-[6rem] bg-muted/50 rounded-md flex flex-wrap items-center justify-center gap-2 font-mono text-xl">
                            {formulaAnswerParts.length > 0 ? (
                                formulaAnswerParts.map((part, index) => (
                                    <Button key={`${part}-${index}`} variant="secondary" onClick={() => handleSortableItemClick(part, 'answer', formulaAnswerParts, setFormulaAnswerParts, formulaOptionParts, setFormulaOptionParts)} className="cursor-pointer">
                                        {part}
                                    </Button>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground">Assemble the formula here</p>
                            )}
                        </div>

                        {/* Options Zone */}
                        <div className="w-full p-4 min-h-[6rem] bg-muted/20 rounded-md flex flex-wrap items-center justify-center gap-2 font-mono text-xl">
                             {formulaOptionParts.map((part, index) => (
                                <Button key={`${part}-${index}`} variant="outline" onClick={() => handleSortableItemClick(part, 'options', formulaOptionParts, setFormulaOptionParts, formulaAnswerParts, setFormulaAnswerParts)} className="cursor-pointer">
                                    {part}
                                </Button>
                             ))}
                        </div>
                        <Button onClick={() => handleSubmitAnswer('submit_formula')} className="w-full max-w-sm" disabled={isCorrect !== null || formulaOptionParts.length > 0}>Submit</Button>
                    </div>
                )}

                {currentRound.miniGameType === 'timeline-teaser' && (
                    <div className="flex flex-col items-center gap-4 w-full">
                        {/* Answer Drop Zone */}
                        <div className="w-full p-4 min-h-[6rem] bg-muted/50 rounded-md flex flex-col items-center justify-center gap-2 text-base">
                            {timelineAnswerOrder.length > 0 ? (
                                timelineAnswerOrder.map((item, index) => (
                                    <Button key={`${item}-${index}`} variant="secondary" onClick={() => handleSortableItemClick(item, 'answer', timelineAnswerOrder, setTimelineAnswerOrder, timelineOptionItems, setTimelineOptionItems)} className="cursor-pointer w-full text-left justify-start">
                                        <span className="font-bold mr-2">{index + 1}.</span>{item}
                                    </Button>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground">Arrange the events here</p>
                            )}
                        </div>

                        {/* Options Zone */}
                        <div className="w-full p-4 min-h-[6rem] bg-muted/20 rounded-md flex flex-col items-center justify-center gap-2 text-base">
                             {timelineOptionItems.map((item, index) => (
                                <Button key={`${item}-${index}`} variant="outline" onClick={() => handleSortableItemClick(item, 'options', timelineOptionItems, setTimelineOptionItems, timelineAnswerOrder, setTimelineAnswerOrder)} className="cursor-pointer w-full text-left justify-start">
                                    {item}
                                </Button>
                             ))}
                        </div>
                        <Button onClick={() => handleSubmitAnswer('submit_timeline')} className="w-full max-w-sm" disabled={isCorrect !== null || timelineOptionItems.length > 0}>Submit</Button>
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

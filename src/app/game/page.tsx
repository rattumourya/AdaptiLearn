"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
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
import { MOCK_GAMES } from "@/lib/mock-data";
import { generateHint } from "@/ai/flows/generate-hint";
import {
  customizeGameDifficulty,
  type CustomizeGameDifficultyOutput,
} from "@/ai/flows/game-customization";
import {
  Loader2,
  Lightbulb,
  CheckCircle,
  XCircle,
  ChevronLeft,
  RefreshCw,
  Send,
  Star,
} from "lucide-react";
import type { Game } from "@/lib/types";

// --- Wordscapes Components ---

const LetterWheel = ({
  letters,
  onWordChange,
}: {
  letters: string[];
  onWordChange: (word: string) => void;
}) => {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [currentWord, setCurrentWord] = useState("");
  const [shuffledLetters, setShuffledLetters] = useState([...letters]);

  const handleLetterClick = (index: number) => {
    let newIndices;
    if (selectedIndices.includes(index)) {
      // Allow unselecting the last letter
      if (selectedIndices.at(-1) === index) {
        newIndices = selectedIndices.slice(0, -1);
      } else {
        return; // Don't allow unselecting from the middle
      }
    } else {
      newIndices = [...selectedIndices, index];
    }
    
    setSelectedIndices(newIndices);
    const newWord = newIndices.map((i) => shuffledLetters[i]).join("");
    setCurrentWord(newWord);
    onWordChange(newWord);
  };

  const shuffleLetters = useCallback(() => {
    setShuffledLetters((prev) => [...prev].sort(() => Math.random() - 0.5));
    setSelectedIndices([]);
    setCurrentWord("");
    onWordChange("");
  }, [onWordChange]);

  useEffect(() => {
    shuffleLetters();
  }, [letters, shuffleLetters]);

  return (
    <div className="flex flex-col items-center gap-4 my-8">
      <div className="relative h-64 w-64">
        {shuffledLetters.map((letter, index) => {
          const angle = (index / shuffledLetters.length) * 2 * Math.PI;
          const x = 96 * Math.cos(angle - Math.PI / 2); // 96 is radius
          const y = 96 * Math.sin(angle - Math.PI / 2);
          return (
            <button
              key={`${letter}-${index}`}
              onClick={() => handleLetterClick(index)}
              className={`absolute flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold uppercase shadow-md transition-all
                ${
                  selectedIndices.includes(index)
                    ? "bg-primary text-primary-foreground scale-105"
                    : "bg-card hover:bg-muted"
                }`}
              style={{
                transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
                left: "50%",
                top: "50%",
              }}
            >
              {letter}
            </button>
          );
        })}
      </div>
       <Button onClick={shuffleLetters} variant="ghost" size="icon">
        <RefreshCw className="h-5 w-5" />
        <span className="sr-only">Shuffle</span>
      </Button>
    </div>
  );
};

const WordGrid = ({ words, foundWords }: { words: string[], foundWords: string[] }) => {
    // Sort words by length for a typical puzzle feel
    const sortedWords = [...words].sort((a, b) => a.length - b.length);

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2 my-4 p-4 bg-muted/50 rounded-lg">
            {sortedWords.map(word => (
                <div key={word} className="flex items-center gap-2">
                    {word.split('').map((letter, index) => (
                        <div key={index} className="flex items-center justify-center h-8 w-8 rounded bg-background border-2">
                             <span className={`text-xl font-bold uppercase transition-opacity ${foundWords.includes(word) ? 'opacity-100' : 'opacity-0'}`}>
                                {letter}
                             </span>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};


function GameComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [game, setGame] = useState<Game | null>(null);
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const [documentContent, setDocumentContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [gameData, setGameData] = useState<CustomizeGameDifficultyOutput | null>(null);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [isHintLoading, setIsHintLoading] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  // Wordscapes specific state
  const [foundMainWords, setFoundMainWords] = useState<string[]>([]);
  const [foundBonusWords, setFoundBonusWords] = useState<string[]>([]);
  const [lastSubmissionStatus, setLastSubmissionStatus] = useState<'correct' | 'bonus' | 'invalid' | 'duplicate' | null>(null);


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
    const content = sessionStorage.getItem("game_document_content");

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

        if (result.gameType?.toLowerCase().includes('wordscapes')) {
          const wordscapesData = result.gameData as { letters: string[], mainWords: string[], bonusWords: string[] };
          // Ensure bonus words are unique and not in main words as a safeguard
          const mainWordsSet = new Set(wordscapesData.mainWords.map(w => w.toLowerCase()));
          const uniqueBonusWords = Array.from(new Set(wordscapesData.bonusWords.map(w => w.toLowerCase())))
            .filter(bw => !mainWordsSet.has(bw));
          
          wordscapesData.bonusWords = uniqueBonusWords;
          result.gameData = wordscapesData;
        }

        setGameData(result);
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

  useEffect(() => {
    if (gameData && gameData.gameType?.toLowerCase().includes('wordscapes')) {
        const wordscapesData = gameData.gameData as { letters: string[], mainWords: string[], bonusWords: string[] };
        if (wordscapesData.mainWords.length > 0 && foundMainWords.length === wordscapesData.mainWords.length) {
            setIsFinished(true);
        }
    }
  }, [foundMainWords, gameData]);


  const handleGetHint = async () => {
    if (!gameData || !documentContent) return;
    setIsHintLoading(true);

    const currentWord = "the game words"; // Simplified for now
    
    try {
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
    if (!gameData || !userAnswer) return;

    const answer = userAnswer.toLowerCase();

    if (gameData.gameType?.toLowerCase().includes('wordscapes')) {
        const wordscapesData = gameData.gameData as { letters: string[], mainWords: string[], bonusWords: string[] };

        const isMainWord = wordscapesData.mainWords.map(w => w.toLowerCase()).includes(answer);
        const isBonusWord = wordscapesData.bonusWords.map(w => w.toLowerCase()).includes(answer);

        if (isMainWord) {
            if (foundMainWords.includes(answer)) {
                setLastSubmissionStatus('duplicate');
            } else {
                setLastSubmissionStatus('correct');
                setFoundMainWords(prev => [...prev, answer]);
                setScore(prev => prev + answer.length * 10);
            }
        } else if (isBonusWord) {
             if (foundBonusWords.includes(answer)) {
                setLastSubmissionStatus('duplicate');
            } else {
                setLastSubmissionStatus('bonus');
                setFoundBonusWords(prev => [...prev, answer]);
                setScore(prev => prev + 5);
            }
        } else {
            setLastSubmissionStatus('invalid');
        }

    } else { // Simple unscramble game logic
      const simpleGameData = gameData.gameData as {word: string}[];
      const currentWord = simpleGameData[currentRoundIndex].word;
      const correct = answer.trim().toLowerCase() === currentWord.toLowerCase();
      setIsCorrect(correct);
      if (correct) {
        setScore(score + 1);
      }
       setTimeout(() => {
        setIsCorrect(null);
        if (currentRoundIndex < simpleGameData.length - 1) {
          setCurrentRoundIndex(currentRoundIndex + 1);
        } else {
          setIsFinished(true);
        }
      }, 1500);
    }
    setUserAnswer("");

    // Reset feedback after a delay
    setTimeout(() => setLastSubmissionStatus(null), 1500);
  };

  const getSubmissionFeedback = () => {
    switch (lastSubmissionStatus) {
      case 'correct':
        return <p className="text-green-500 font-bold">Correct!</p>;
      case 'bonus':
        return <p className="text-blue-500 font-bold">Bonus Word!</p>;
      case 'duplicate':
        return <p className="text-yellow-500 font-bold">Already found!</p>;
      case 'invalid':
        return <p className="text-red-500 font-bold">Invalid word</p>;
      default:
        return <p className="h-6">&nbsp;</p>; // Placeholder for alignment
    }
  };


  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="ml-4 text-lg">Crafting your game...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button onClick={() => router.push("/dashboard")} className="mt-4">
            Go to Dashboard
          </Button>
        </Alert>
      </div>
    );
  }
  
  if (isFinished) {
      const totalWords = gameData?.gameType?.toLowerCase().includes('wordscapes') 
        ? ((gameData.gameData as any).mainWords?.length || 1)
        : ((gameData?.gameData as any)?.length || 1);

      const finalScore = gameData?.gameType?.toLowerCase().includes('wordscapes')
        ? score 
        : `${score} / ${totalWords}`;
        
      const completionValue = gameData?.gameType?.toLowerCase().includes('wordscapes')
        ? (foundMainWords.length / totalWords) * 100
        : (score / totalWords) * 100;

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <CardTitle className="font-headline text-3xl">Game Over!</CardTitle>
                    <CardDescription>You've completed {gameData?.gameTitle}.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-xl">Your final score is:</p>
                    <p className="text-5xl font-bold text-primary my-4">{finalScore}</p>
                    {gameData?.gameType?.toLowerCase().includes('wordscapes') && (
                        <div className="text-sm text-muted-foreground">
                            <p>Main words found: {foundMainWords.length} / {totalWords}</p>
                            <p>Bonus words found: {foundBonusWords.length}</p>
                        </div>
                    )}
                    <Progress value={completionValue} className="mt-4" />
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
    <div className="container mx-auto max-w-3xl py-8">
      <Button variant="ghost" onClick={() => router.push("/dashboard")} className="mb-4">
        <ChevronLeft className="mr-2 h-4 w-4" />
        Back to Library
      </Button>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="font-headline text-3xl">{game?.name}</CardTitle>
              <CardDescription>{gameData?.gameTitle}</CardDescription>
            </div>
            <Badge variant="secondary" className="capitalize">
              {difficulty}
            </Badge>
          </div>
           {gameData?.gameType?.toLowerCase().includes('wordscapes') ? (
               <Progress value={(foundMainWords.length / ((gameData.gameData as any).mainWords.length || 1)) * 100} className="mt-4" />
           ) : (
                <Progress value={((currentRoundIndex + 1) / ((gameData?.gameData as any)?.length || 1)) * 100} className="mt-4" />
           )}
        </CardHeader>
        
        {gameData?.gameType?.toLowerCase().includes('wordscapes') ? (
            // WORDSCAPES UI
            <CardContent className="flex flex-col items-center">
                <WordGrid words={(gameData.gameData as any).mainWords} foundWords={foundMainWords}/>

                <div className="h-6 my-2">
                  {getSubmissionFeedback()}
                </div>
                <div className="text-2xl font-bold tracking-widest uppercase h-10 flex items-center justify-center bg-background border-b-2 w-48 text-center">
                    {userAnswer}
                </div>

                <LetterWheel letters={(gameData.gameData as any).letters} onWordChange={setUserAnswer} />

                <form onSubmit={handleSubmitAnswer} className="w-full flex items-center justify-center gap-2">
                     <Button type="submit" className="w-48" disabled={!userAnswer || lastSubmissionStatus !== null}>
                        <Send className="mr-2" /> Submit
                    </Button>
                </form>
            </CardContent>
        ) : (
            // SIMPLE UNSCRAMBLE UI
            <CardContent className="text-center">
              {(gameData?.gameData as any)?.[currentRoundIndex] && (
                <div className="my-8">
                    <p className="text-muted-foreground mb-2">{(gameData?.gameData as any)[currentRoundIndex].displayPrompt}</p>
                    <p className="text-4xl font-bold tracking-widest uppercase">
                        {(gameData?.gameData as any)[currentRoundIndex].scrambled}
                    </p>
                </div>
              )}
            <form onSubmit={handleSubmitAnswer}>
              <div className="relative max-w-sm mx-auto">
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
              <Button type="submit" className="mt-4 w-full max-w-sm" disabled={isCorrect !== null}>
                  Submit
              </Button>
            </form>
          </CardContent>
        )}
        
        <CardFooter className="flex justify-between items-center">
            <div>
                 <p className="text-sm text-muted-foreground">Score: {score}</p>
                 {gameData?.gameType?.toLowerCase().includes('wordscapes') && (
                     <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-500"/> Bonus Words: {foundBonusWords.length}
                    </p>
                 )}
            </div>
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
  );
}

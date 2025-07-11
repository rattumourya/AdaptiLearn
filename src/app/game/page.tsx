
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
  Heart,
  Timer,
  Check,
  X,
  Eye,
} from "lucide-react";
import type { Game } from "@/lib/types";
import { cn } from "@/lib/utils";

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
                        <div key={`${word}-${index}`} className="flex items-center justify-center h-8 w-8 rounded bg-background border-2">
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

const WordCollection = ({ words, foundWords }: { words: string[], foundWords: string[] }) => {
    const groupedWords = words.reduce((acc, word) => {
        const len = word.length;
        if (!acc[len]) {
            acc[len] = [];
        }
        acc[len].push(word);
        return acc;
    }, {} as Record<number, string[]>);

    return (
        <div className="flex flex-wrap justify-center gap-4 my-4 p-4 bg-muted/50 rounded-lg">
            {Object.keys(groupedWords).sort().map(len => (
                <div key={len} className="flex flex-col items-center">
                    <h3 className="font-bold text-lg mb-2">{len} Letters</h3>
                    <div className="flex flex-col gap-2">
                        {groupedWords[len as any].map((word, index) => (
                             <div key={`${word}-${index}`} className="px-4 py-2 rounded bg-background border-2 text-center min-w-[120px]">
                                 <span className={`text-lg font-semibold uppercase tracking-widest transition-opacity ${foundWords.includes(word) ? 'opacity-100' : 'opacity-25'}`}>
                                    {foundWords.includes(word) ? word : "•".repeat(word.length)}
                                 </span>
                             </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

// --- Game Logic ---

/**
 * Validates if a word can be formed from a given set of letters, respecting letter counts.
 * @param word The word to validate (e.g., "apple").
 * @param letters The available letters (e.g., ['a', 'p', 'p', 'l', 'e']).
 * @returns True if the word is valid, false otherwise.
 */
function isWordValid(word: string, letters: string[]): boolean {
  const wordLower = word.toLowerCase();
  const lettersLower = letters.map(l => l.toLowerCase());
  
  const letterCounts: Record<string, number> = {};
  for (const letter of lettersLower) {
    letterCounts[letter] = (letterCounts[letter] || 0) + 1;
  }

  for (const char of wordLower) {
    if (!letterCounts[char] || letterCounts[char] === 0) {
      return false; // Letter not available or not enough of them
    }
    letterCounts[char]--;
  }

  return true;
}


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

  // Wordscapes/Word Cookies specific state
  const [foundMainWords, setFoundMainWords] = useState<string[]>([]);
  const [foundBonusWords, setFoundBonusWords] = useState<string[]>([]);
  const [lastSubmissionStatus, setLastSubmissionStatus] = useState<'correct' | 'bonus' | 'invalid' | 'duplicate' | null>(null);
  
  // Drops specific state
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);

  const isWordPuzzleGame = gameData?.gameType?.toLowerCase().includes('wordscapes') || gameData?.gameType?.toLowerCase().includes('word cookies') || gameData?.gameType?.toLowerCase().includes('spelling bee');

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

        // Safeguard for Word Puzzle games
        if (result.gameType?.toLowerCase().includes('wordscapes') || result.gameType?.toLowerCase().includes('word cookies') || result.gameType?.toLowerCase().includes('spelling bee')) {
          const wordPuzzleData = result.gameData as { letters: string[], mainWords: string[], bonusWords: string[] };
          
          // Filter words to ensure they are valid based on the given letters
          const validMainWords = wordPuzzleData.mainWords.filter(word => isWordValid(word, wordPuzzleData.letters));
          const validBonusWords = wordPuzzleData.bonusWords.filter(word => isWordValid(word, wordPuzzleData.letters));
          
          const mainWordsSet = new Set(validMainWords.map(w => w.toLowerCase()));
          const uniqueBonusWords = Array.from(new Set(validBonusWords.map(w => w.toLowerCase())))
            .filter(bw => !mainWordsSet.has(bw));
          
          wordPuzzleData.mainWords = validMainWords;
          wordPuzzleData.bonusWords = uniqueBonusWords;
          result.gameData = wordPuzzleData;
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
    if (!gameData || isLoading || isFinished) return;

    if (gameData.gameType?.toLowerCase().includes('drops')) {
        if (timeLeft > 0 && lives > 0) {
            const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setIsFinished(true);
        }
    }
  }, [timeLeft, lives, gameData, isLoading, isFinished]);


  useEffect(() => {
    if (gameData && isWordPuzzleGame) {
        const wordPuzzleData = gameData.gameData as { letters: string[], mainWords: string[], bonusWords: string[] };
        if (wordPuzzleData.mainWords.length > 0 && foundMainWords.length === wordPuzzleData.mainWords.length) {
            setIsFinished(true);
        }
    }
  }, [foundMainWords, gameData, isWordPuzzleGame]);


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

  const handleRevealAnswer = () => {
    if (!gameData || !isWordPuzzleGame) return;
    const wordPuzzleData = gameData.gameData as { letters: string[], mainWords: string[], bonusWords: string[] };
    
    const unfoundWord = wordPuzzleData.mainWords.find(
      (word) => !foundMainWords.includes(word.toLowerCase())
    );

    if (unfoundWord) {
      setFoundMainWords((prev) => [...prev, unfoundWord.toLowerCase()]);
      setScore((prev) => Math.max(0, prev - 25)); // Deduct points
      toast({
        title: "Answer Revealed!",
        description: `The word was: ${unfoundWord.toUpperCase()}`,
      });
    } else {
      toast({
        title: "No more words to reveal!",
        description: "You've found them all.",
      });
    }
  };


  const advanceToNextRound = (delay: number) => {
    setTimeout(() => {
        setIsCorrect(null);
        if (gameData?.gameType?.toLowerCase().includes('drops')) {
            const dropsGameData = gameData.gameData as any[];
            if (currentRoundIndex < dropsGameData.length - 1) {
                setCurrentRoundIndex(currentRoundIndex + 1);
            } else {
                setIsFinished(true);
            }
        }
        setUserAnswer("");
    }, delay);
  };

  const handleCorrectAnswer = () => {
    const points = 10 + streak * 2;
    setScore(prev => prev + points);
    setStreak(prev => prev + 1);
    setIsCorrect(true);
    advanceToNextRound(1200);
  };

  const handleIncorrectAnswer = () => {
    setLives(prev => prev - 1);
    setStreak(0);
    setIsCorrect(false);
    if (lives - 1 <= 0) {
        setIsFinished(true);
    } else {
        advanceToNextRound(1200);
    }
  };


  const handleSubmitAnswer = (e: React.FormEvent | string) => {
    if (typeof e !== 'string') e.preventDefault();
    if (!gameData || isCorrect !== null) return;
    
    const submittedAnswer = (typeof e === 'string' ? e : userAnswer).trim().toLowerCase();
    if (!submittedAnswer) return;

    if (isWordPuzzleGame) {
        const wordPuzzleData = gameData.gameData as { letters: string[], mainWords: string[], bonusWords: string[] };
        
        // Also check if the submitted word is valid given the letters as a final client-side check
        if (!isWordValid(submittedAnswer, wordPuzzleData.letters)) {
            setLastSubmissionStatus('invalid');
            setUserAnswer("");
            setTimeout(() => setLastSubmissionStatus(null), 1500);
            return;
        }

        const isMainWord = wordPuzzleData.mainWords.map(w => w.toLowerCase()).includes(submittedAnswer);
        const isBonusWord = wordPuzzleData.bonusWords.map(w => w.toLowerCase()).includes(submittedAnswer);

        if (isMainWord) {
            if (foundMainWords.includes(submittedAnswer)) {
                setLastSubmissionStatus('duplicate');
            } else {
                setLastSubmissionStatus('correct');
                setFoundMainWords(prev => [...prev, submittedAnswer]);
                setScore(prev => prev + submittedAnswer.length * 10);
            }
        } else if (isBonusWord) {
             if (foundBonusWords.includes(submittedAnswer)) {
                setLastSubmissionStatus('duplicate');
            } else {
                setLastSubmissionStatus('bonus');
                setFoundBonusWords(prev => [...prev, submittedAnswer]);
                setScore(prev => prev + 5);
            }
        } else {
            setLastSubmissionStatus('invalid');
        }
        setUserAnswer("");
        setTimeout(() => setLastSubmissionStatus(null), 1500);

    } else { // Logic for Drops and other sequential games
        const currentRound = (gameData.gameData as any[])[currentRoundIndex];
        let correct = false;

        switch (currentRound.miniGameType) {
            case 'unscramble':
                correct = submittedAnswer === currentRound.word.toLowerCase();
                break;
            case 'multiple-choice':
                correct = submittedAnswer === currentRound.correctAnswer.toLowerCase();
                break;
            case 'true-false':
                correct = (submittedAnswer === 'true') === currentRound.isTrue;
                break;
        }

        if (correct) {
            handleCorrectAnswer();
        } else {
            handleIncorrectAnswer();
        }
    }
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
    const isPuzzle = isWordPuzzleGame;
    const totalWords = isPuzzle 
      ? ((gameData?.gameData as any).mainWords?.length || 1)
      : ((gameData?.gameData as any)?.length || 1);
    
    const finalScoreText = isPuzzle ? score : `${score} points`;

    const completionMessage = () => {
        if (isPuzzle) {
            return `Main words found: ${foundMainWords.length} / ${totalWords}`;
        }
        if (lives <= 0) {
            return "You ran out of lives!";
        }
        if (timeLeft <= 0) {
            return "Time's up!";
        }
        return `You completed all the questions!`;
    };

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <CardTitle className="font-headline text-3xl">Game Over!</CardTitle>
                    <CardDescription>{completionMessage()}</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-xl">Your final score is:</p>
                    <p className="text-5xl font-bold text-primary my-4">{finalScoreText}</p>
                    {isPuzzle && (
                        <div className="text-sm text-muted-foreground">
                            <p>Bonus words found: {foundBonusWords.length}</p>
                        </div>
                    )}
                     {!isPuzzle && (
                        <div className="text-sm text-muted-foreground">
                             <p>Highest streak: {streak}</p>
                             <p>Rounds completed: {currentRoundIndex + 1} / {totalWords}</p>
                        </div>
                    )}
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

  const renderGameHeader = () => {
    const isDrops = gameData?.gameType?.toLowerCase().includes('drops');

    return (
      <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="font-headline text-3xl">{game?.name}</CardTitle>
              <CardDescription>{gameData?.gameTitle}</CardDescription>
            </div>
            {isDrops ? (
                 <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-rose-500 font-semibold">
                         <Heart className="w-5 h-5"/>
                         <span>{lives}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
                        <Timer className="w-5 h-5"/>
                        <span>{Math.floor(timeLeft / 60)}:{('0' + timeLeft % 60).slice(-2)}</span>
                    </div>
                </div>
            ) : (
                <Badge variant="secondary" className="capitalize">
                    {difficulty}
                </Badge>
            )}
          </div>
           {isWordPuzzleGame ? (
               <Progress value={(foundMainWords.length / ((gameData?.gameData as any).mainWords.length || 1)) * 100} className="mt-4" />
           ) : (
                <Progress value={((currentRoundIndex + 1) / ((gameData?.gameData as any)?.length || 1)) * 100} className="mt-4" />
           )}
      </CardHeader>
    )
  };

  const renderCurrentRound = () => {
    if (!gameData || isWordPuzzleGame) return null;

    const currentRound = (gameData.gameData as any[])[currentRoundIndex];
    if (!currentRound) return null;

    const getFeedbackRingColor = () => {
        if (isCorrect === true) return "ring-green-500";
        if (isCorrect === false) return "ring-red-500";
        return "ring-transparent";
    }

    return (
        <CardContent className={cn("text-center transition-all duration-300", getFeedbackRingColor())}>
            <div className={`p-4 rounded-lg ring-4 ${getFeedbackRingColor()}`}>
            {currentRound.miniGameType === 'unscramble' && (
                <>
                    <p className="text-muted-foreground mb-2">{currentRound.displayPrompt}</p>
                    <p className="text-4xl font-bold tracking-widest uppercase my-8">
                        {currentRound.scrambled}
                    </p>
                    <form onSubmit={handleSubmitAnswer}>
                        <Input
                            type="text"
                            placeholder="Type your answer..."
                            value={userAnswer}
                            onChange={(e) => setUserAnswer(e.target.value)}
                            className="text-center text-lg h-12 max-w-sm mx-auto"
                            disabled={isCorrect !== null}
                        />
                        <Button type="submit" className="mt-4 w-full max-w-sm" disabled={isCorrect !== null}>
                            Submit
                        </Button>
                    </form>
                </>
            )}
            {currentRound.miniGameType === 'multiple-choice' && (
                <>
                    <p className="text-lg font-semibold mb-6">{currentRound.question}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {currentRound.options.map((option: string) => (
                            <Button
                                key={option}
                                variant="outline"
                                className="h-auto py-4 text-base"
                                onClick={() => handleSubmitAnswer(option)}
                                disabled={isCorrect !== null}
                            >
                                {option}
                            </Button>
                        ))}
                    </div>
                </>
            )}
            {currentRound.miniGameType === 'true-false' && (
                <>
                    <p className="text-lg font-semibold mb-6">{currentRound.statement}</p>
                    <div className="flex justify-center gap-4">
                        <Button
                            variant="outline"
                            className="h-16 w-32 text-lg bg-green-50 hover:bg-green-100 text-green-800"
                            onClick={() => handleSubmitAnswer("true")}
                            disabled={isCorrect !== null}
                        >
                            <Check className="mr-2"/> True
                        </Button>
                        <Button
                            variant="outline"
                            className="h-16 w-32 text-lg bg-red-50 hover:bg-red-100 text-red-800"
                             onClick={() => handleSubmitAnswer("false")}
                             disabled={isCorrect !== null}
                        >
                            <X className="mr-2"/> False
                        </Button>
                    </div>
                </>
            )}
            </div>
        </CardContent>
    );
};
  
  const renderWordPuzzleGame = () => {
    if (!gameData || !isWordPuzzleGame) return null;
    
    const isWordscapes = gameData.gameType?.toLowerCase().includes('wordscapes');
    const wordPuzzleData = gameData.gameData as { letters: string[], mainWords: string[], bonusWords: string[] };

    return (
        <CardContent className="flex flex-col items-center">
            {isWordscapes ? (
                <WordGrid words={wordPuzzleData.mainWords} foundWords={foundMainWords}/>
            ) : (
                <WordCollection words={wordPuzzleData.mainWords} foundWords={foundMainWords} />
            )}

            <div className="h-6 my-2">
              {getSubmissionFeedback()}
            </div>
            <div className="text-2xl font-bold tracking-widest uppercase h-10 flex items-center justify-center bg-background border-b-2 w-48 text-center">
                {userAnswer}
            </div>

            <LetterWheel letters={wordPuzzleData.letters} onWordChange={setUserAnswer} />

            <form onSubmit={handleSubmitAnswer} className="w-full flex items-center justify-center gap-2">
                 <Button type="submit" className="w-48" disabled={!userAnswer || lastSubmissionStatus !== null}>
                    <Send className="mr-2" /> Submit
                </Button>
            </form>
        </CardContent>
    )
  }

  return (
    <div className="container mx-auto max-w-3xl py-8">
      <Button variant="ghost" onClick={() => router.push("/dashboard")} className="mb-4">
        <ChevronLeft className="mr-2 h-4 w-4" />
        Back to Library
      </Button>
      <Card>
        {renderGameHeader()}
        
        {isWordPuzzleGame ? renderWordPuzzleGame() : renderCurrentRound()}
        
        <CardFooter className="flex justify-between items-center">
            <div className="flex-1">
                 <p className="text-sm text-muted-foreground">Score: {score}</p>
                 {isWordPuzzleGame ? (
                     <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-500"/> Bonus Words: {foundBonusWords.length}
                    </p>
                 ) : (
                     <p className="text-sm text-muted-foreground">Streak: {streak}x</p>
                 )}
            </div>
             <div className="flex items-center gap-2">
                {isWordPuzzleGame && (
                  <Button variant="outline" size="sm" onClick={handleRevealAnswer}>
                    <Eye className="mr-2 h-4 w-4" /> Reveal Answer
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleGetHint} disabled={isHintLoading}>
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
    <Suspense fallback={<div>Loading...</div>}>
      <GameComponent />
    </Suspense>
  );
}

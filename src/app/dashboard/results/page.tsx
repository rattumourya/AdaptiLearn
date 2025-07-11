
"use client";

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { BarChart3, CheckCircle, Clock, Gamepad2, Loader2, Star, TrendingUp } from "lucide-react";
import { format } from "date-fns";

import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface GameResult {
  id: string;
  gameType: string;
  difficulty: string;
  score: number;
  status: "started" | "completed";
  startedAt: any; // Firestore Timestamp
  completedAt?: any; // Firestore Timestamp
}

export default function ResultsPage() {
  const { user, loading: authLoading } = useAuth();
  const [results, setResults] = useState<GameResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setIsLoading(true);
      const resultsRef = collection(db, "gameResults");
      const q = query(
        resultsRef,
        where("userId", "==", user.uid),
        where("status", "==", "completed"),
        orderBy("completedAt", "desc")
      );

      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          const userResults = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as GameResult[];
          setResults(userResults);
          setIsLoading(false);
        },
        (error) => {
          console.error("Error fetching game results:", error);
          setIsLoading(false);
        }
      );

      return () => unsubscribe();
    }
  }, [user]);

  const renderSkeleton = () => (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            My Progress
          </h1>
          <p className="text-muted-foreground">
            Review your past game sessions and track your scores.
          </p>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Game History</CardTitle>
          <CardDescription>
            A log of all your completed learning sessions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {authLoading || isLoading ? (
            renderSkeleton()
          ) : results.length === 0 ? (
            <Alert>
              <Gamepad2 className="h-4 w-4" />
              <AlertTitle>No Games Played Yet!</AlertTitle>
              <AlertDescription>
                Complete a game from your library to see your results here.
              </AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Game</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Date Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell className="font-medium">
                      {result.gameType}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{result.difficulty}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary">
                      {result.score}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {result.completedAt
                        ? format(result.completedAt.toDate(), "MMM d, yyyy 'at' h:mm a")
                        : "N/A"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

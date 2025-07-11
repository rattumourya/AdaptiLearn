
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Camera, Loader2, User } from "lucide-react";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { db, storage } from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";

const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", email: "" },
  });

  useEffect(() => {
    if (user) {
      const fetchUserData = async () => {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef).catch((error) => {
          console.error("Firestore read failed:", error);
          return null; // Handle case where Firestore might be offline/unreachable
        });
        
        if (userDocSnap && userDocSnap.exists()) {
          const userData = userDocSnap.data();
          form.reset({
            name: userData.name || user.name || "",
            email: userData.email || user.email || "",
          });
          setAvatarPreview(userData.photoURL || user.photoURL || null);
        } else {
          // Fallback to auth data if Firestore doc doesn't exist
          form.reset({
            name: user.name || "",
            email: user.email || "",
          });
          setAvatarPreview(user.photoURL || null);
        }
      };
      fetchUserData();
    }
  }, [user, form]);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid File Type", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      toast({ title: "File Too Large", description: "Please select an image smaller than 2MB.", variant: "destructive" });
      return;
    }

    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) {
      toast({ title: "Not authenticated", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      let photoURL = avatarPreview;

      // If a new avatar file was selected, upload it
      if (avatarFile) {
        const storageRef = ref(storage, `avatars/${user.uid}/${avatarFile.name}`);
        const snapshot = await uploadBytes(storageRef, avatarFile);
        photoURL = await getDownloadURL(snapshot.ref);
      }

      // Update user profile in Firestore
      const userDocRef = doc(db, "users", user.uid);
      // Use setDoc with merge:true to create or update
      await setDoc(userDocRef, {
        name: values.name,
        photoURL: photoURL || null,
        email: values.email,
      }, { merge: true });

      toast({
        title: "Profile Updated",
        description: "Your changes have been saved successfully.",
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({ title: "Save Failed", description: "Could not update your profile.", variant: "destructive" });
    } finally {
      setIsSaving(false);
      setAvatarFile(null);
    }
  };

  if (authLoading || (user && !form.getValues('email'))) {
    return (
        <div className="mx-auto grid max-w-4xl gap-6">
            <div className="space-y-2">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-64" />
            </div>
            <Card>
              <CardHeader><CardTitle><Skeleton className="h-6 w-40" /></CardTitle><CardDescription><Skeleton className="h-4 w-80" /></CardDescription></CardHeader>
              <CardContent className="space-y-6">
                 <div className="flex flex-col items-center gap-4 sm:flex-row">
                    <Skeleton className="h-24 w-24 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-4 w-48" />
                    </div>
                 </div>
                 <Skeleton className="h-10 w-full" />
                 <Skeleton className="h-10 w-full" />
              </CardContent>
              <CardFooter><Skeleton className="h-10 w-24" /></CardFooter>
            </Card>
        </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <div className="space-y-2">
        <h1 className="font-headline text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and profile information.
        </p>
      </div>
      <Card>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle>Public Profile</CardTitle>
              <CardDescription>
                This information will be displayed on your profile and
                leaderboards.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="relative">
                  <Avatar className="h-24 w-24">
                    <AvatarImage
                      src={avatarPreview || undefined}
                      alt="User Avatar"
                      data-ai-hint="person avatar"
                    />
                    <AvatarFallback>
                      <User className="h-10 w-10" />
                    </AvatarFallback>
                  </Avatar>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarChange}
                    className="hidden"
                    accept="image/png, image/jpeg, image/gif"
                    disabled={isSaving}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="absolute bottom-0 right-0 rounded-full"
                    onClick={() => fileInputrRef.current?.click()}
                    disabled={isSaving}
                  >
                    <Camera />
                    <span className="sr-only">Upload Photo</span>
                  </Button>
                </div>
                <div className="text-center sm:text-left">
                  <h3 className="text-lg font-semibold">
                    {form.watch("name")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {form.watch("email")}
                  </p>
                </div>
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="Your display name" {...field} disabled={isSaving} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="you@example.com"
                        {...field}
                        disabled
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground pt-1">
                      Email cannot be changed.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 animate-spin" />}
                Save Changes
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}

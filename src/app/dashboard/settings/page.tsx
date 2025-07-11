// src/app/dashboard/settings/page.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Camera, Loader2, User } from "lucide-react";

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

const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email(),
  // We'll handle the file separately, but keep it in mind
});

export default function SettingsPage() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    "https://placehold.co/100x100.png"
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Default values can be fetched from a user context or API in a real app
  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "Alex Doe",
      email: "alex.doe@example.com",
    },
  });

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Simple validation for file type and size
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File Type",
        description: "Please select an image file (e.g., PNG, JPG).",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 2MB.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (values: z.infer<typeof profileSchema>) => {
    setIsSaving(true);
    // In a real app, you would upload the file and save the user data here.
    // We'll simulate it with a delay.
    console.log("Saving profile:", {
      ...values,
      avatar: avatarPreview?.startsWith('data:') ? 'New image data...' : 'Existing image URL'
    });

    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast({
      title: "Profile Updated",
      description: "Your changes have been saved successfully.",
    });
    setIsSaving(false);
  };

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
       <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight font-headline">Settings</h1>
            <p className="text-muted-foreground">Manage your account settings and profile information.</p>
        </div>
        <Card>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardHeader>
                <CardTitle className="font-headline">Public Profile</CardTitle>
                <CardDescription>
                  This information will be displayed on your profile and leaderboards.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <div className="relative">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={avatarPreview || undefined} alt="User Avatar" data-ai-hint="person avatar"/>
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
                    />
                    <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="absolute bottom-0 right-0 rounded-full"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Camera className="h-4 w-4"/>
                        <span className="sr-only">Upload Photo</span>
                    </Button>
                  </div>
                  <div className="text-center sm:text-left">
                    <h3 className="text-lg font-semibold">{form.watch('name')}</h3>
                    <p className="text-sm text-muted-foreground">{form.watch('email')}</p>
                    <p className="text-xs text-muted-foreground mt-2">Member since: January 2024</p>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="Your display name" {...field} />
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
                        <Input placeholder="you@example.com" {...field} disabled />
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
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
    </div>
  );
}

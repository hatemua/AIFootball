'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import type { Match } from '@/types';

const formSchema = z.object({
  title: z.string().min(1, 'Required'),
  youtubeUrl: z.string().url('Must be a valid URL'),
});

type FormValues = z.infer<typeof formSchema>;

export function MatchUploadForm() {
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: '', youtubeUrl: '' },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const { data } = await api.post<Match>('/api/matches', {
        title: values.title,
        sourceType: 'youtube',
        sourceUrl: values.youtubeUrl,
      });
      return data;
    },
    onSuccess: (match) => {
      toast({ title: 'Match created', description: 'Processing will start shortly.' });
      router.push(`/matches/${match.id}`);
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to create match', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="space-y-6"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Match title</FormLabel>
              <FormControl>
                <Input placeholder="Liverpool vs City — 2026-04-12" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="youtubeUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>YouTube URL</FormLabel>
              <FormControl>
                <Input placeholder="https://youtube.com/watch?v=..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Submitting...' : 'Process match'}
        </Button>
      </form>
    </Form>
  );
}

import { useState, useEffect, forwardRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X, Calendar, Clock, Users, Video, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MeetingScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId?: string;
  currentUserId?: string;
  participants?: { user_id: string; profile?: { full_name: string | null; email: string } }[];
  isAdmin?: boolean;
  assignedAdmin?: { id: string; full_name: string | null } | null;
}

export const MeetingScheduleDialog = forwardRef<HTMLDivElement, MeetingScheduleDialogProps>(function MeetingScheduleDialog({ open, onOpenChange, conversationId, currentUserId, participants, isAdmin = false, assignedAdmin }, ref) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('30');
  const [meetingType, setMeetingType] = useState<'video' | 'audio'>('video');
  const [generateMeet, setGenerateMeet] = useState(true);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [adminUsers, setAdminUsers] = useState<{ id: string; full_name: string | null; email: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (isAdmin) {
      supabase.from('profiles').select('id, full_name, email').then(({ data }) => {
        if (data) setAdminUsers(data);
      });
      if (participants) {
        setSelectedParticipants(participants.map(p => p.user_id).filter(id => id !== currentUserId));
      }
    } else {
      if (assignedAdmin) {
        setSelectedParticipants([assignedAdmin.id]);
      }
    }
  }, [open, participants, currentUserId, isAdmin, assignedAdmin]);

  const handleSubmit = async () => {
    if (!title || !date || !time || !currentUserId) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setSaving(true);
    try {
      const scheduledAt = new Date(`${date}T${time}`).toISOString();

      const { data: meeting, error } = await supabase
        .from('meetings')
        .insert({
          conversation_id: conversationId || null,
          title,
          description,
          scheduled_at: scheduledAt,
          duration_minutes: parseInt(duration),
          meeting_type: meetingType,
          created_by: currentUserId,
        })
        .select()
        .single();

      if (error) throw error;

      const allParticipants = [currentUserId, ...selectedParticipants];

      // Generate Google Meet link
      let meetLink: string | null = null;
      if (generateMeet) {
        try {
          const participantEmails = adminUsers
            .filter(u => allParticipants.includes(u.id))
            .map(u => u.email)
            .filter(Boolean);

          const { data: meetData } = await supabase.functions.invoke('create-google-meet', {
            body: {
              title,
              scheduled_at: scheduledAt,
              duration_minutes: parseInt(duration),
              attendee_emails: participantEmails,
            },
          });

          if (meetData?.meetLink) {
            meetLink = meetData.meetLink;
            await supabase.from('meetings').update({
              google_meet_link: meetData.meetLink,
              google_event_id: meetData.eventId,
            }).eq('id', meeting.id);
          }
        } catch (meetErr) {
          console.error('Meet generation failed:', meetErr);
        }
      }

      await supabase.from('meeting_participants').insert(
        allParticipants.map(uid => ({
          meeting_id: meeting.id,
          user_id: uid,
          status: uid === currentUserId ? 'accepted' : 'invited',
        }))
      );

      if (conversationId) {
        const meetInfo = meetLink ? `\n🔗 ${meetLink}` : '';
        await supabase.from('conversation_messages').insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: `📅 Reunião agendada: ${title}\n🕐 ${new Date(scheduledAt).toLocaleString('pt-BR')}\n⏱️ ${duration} minutos${meetInfo}`,
          message_type: 'meeting_scheduled',
        });
      }

      toast.success('Reunião agendada com sucesso!');
      onOpenChange(false);
      setTitle('');
      setDescription('');
      setDate('');
      setTime('');
    } catch (err) {
      toast.error('Erro ao agendar reunião');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleParticipant = (id: string) => {
    setSelectedParticipants(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[200] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-[200] grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg">
          <div className="flex flex-col space-y-1.5 text-center sm:text-left">
            <DialogPrimitive.Title className="text-lg font-semibold leading-none tracking-tight flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              Agendar Reunião
            </DialogPrimitive.Title>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Título *</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nome da reunião" />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Descrição</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhes da reunião" rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Data *</label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Hora *</label>
                <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Duração</label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[250]">
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="45">45 min</SelectItem>
                    <SelectItem value="60">1 hora</SelectItem>
                    <SelectItem value="90">1h30</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Tipo</label>
                <Select value={meetingType} onValueChange={v => setMeetingType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[250]">
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="audio">Áudio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              </div>

            {/* Google Meet toggle */}
            <label className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30 cursor-pointer">
              <input type="checkbox" checked={generateMeet} onChange={(e) => setGenerateMeet(e.target.checked)} className="rounded" />
              <Video className="h-4 w-4 text-blue-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">Gerar Google Meet</p>
                <p className="text-xs text-muted-foreground">Link de videoconferência automático</p>
              </div>
            </label>
            {/* Participants */}
            <div>
              <label className="text-sm font-medium mb-2 flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Participantes</label>
              {isAdmin ? (
                <div className="max-h-32 overflow-y-auto space-y-1 border rounded-lg p-2">
                  {adminUsers.filter(u => u.id !== currentUserId).map(u => (
                    <label key={u.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={selectedParticipants.includes(u.id)}
                        onChange={() => toggleParticipant(u.id)}
                        className="rounded"
                      />
                      <span className="truncate">{u.full_name || u.email}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="border rounded-lg p-3 bg-muted/30">
                  {assignedAdmin ? (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-semibold">
                        {assignedAdmin.full_name?.substring(0, 2).toUpperCase() || '??'}
                      </div>
                      <span className="font-medium">{assignedAdmin.full_name || 'Consultor'}</span>
                      <span className="text-xs text-muted-foreground ml-auto">Seu consultor</span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum consultor atribuído</p>
                  )}
                </div>
              )}
            </div>

            <Button onClick={handleSubmit} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calendar className="h-4 w-4 mr-2" />}
              Agendar Reunião
            </Button>
          </div>

          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
});

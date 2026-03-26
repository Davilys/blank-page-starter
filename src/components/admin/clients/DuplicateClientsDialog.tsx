import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Users,
  Merge,
  AlertTriangle,
  Loader2,
  Check,
  RefreshCw,
  Phone,
  Mail,
  CreditCard,
  FileText,
  Building,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DuplicateGroup {
  key: string;
  type: "cpf" | "email" | "phone";
  profiles: ProfileWithStats[];
}

interface ProfileWithStats {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  cpf_cnpj: string | null;
  company_name: string | null;
  created_at: string | null;
  processCount: number;
  contractCount: number;
  invoiceCount: number;
}

interface DuplicateClientsDialogProps {
  onMergeComplete?: () => void;
  trigger?: React.ReactNode;
}

export function DuplicateClientsDialog({
  onMergeComplete,
  trigger,
}: DuplicateClientsDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [selectedMaster, setSelectedMaster] = useState<Record<string, string>>(
    {}
  );
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const findDuplicates = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all profiles with their related counts
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, cpf_cnpj, company_name, created_at")
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (!profiles || profiles.length === 0) {
        setDuplicateGroups([]);
        setLoading(false);
        return;
      }

      // Fetch counts for all profiles
      const profileIds = profiles.map((p) => p.id);

      const [processesResult, contractsResult, invoicesResult] =
        await Promise.all([
          supabase
            .from("brand_processes")
            .select("user_id")
            .in("user_id", profileIds),
          supabase
            .from("contracts")
            .select("user_id")
            .in("user_id", profileIds),
          supabase.from("invoices").select("user_id").in("user_id", profileIds),
        ]);

      // Count per profile
      const processCounts: Record<string, number> = {};
      const contractCounts: Record<string, number> = {};
      const invoiceCounts: Record<string, number> = {};

      (processesResult.data || []).forEach((p) => {
        if (p.user_id)
          processCounts[p.user_id] = (processCounts[p.user_id] || 0) + 1;
      });
      (contractsResult.data || []).forEach((c) => {
        if (c.user_id)
          contractCounts[c.user_id] = (contractCounts[c.user_id] || 0) + 1;
      });
      (invoicesResult.data || []).forEach((i) => {
        if (i.user_id)
          invoiceCounts[i.user_id] = (invoiceCounts[i.user_id] || 0) + 1;
      });

      // Enrich profiles with stats
      const enrichedProfiles: ProfileWithStats[] = profiles.map((p) => ({
        ...p,
        processCount: processCounts[p.id] || 0,
        contractCount: contractCounts[p.id] || 0,
        invoiceCount: invoiceCounts[p.id] || 0,
      }));

      // Find duplicates by CPF
      const cpfGroups: Record<string, ProfileWithStats[]> = {};
      const emailGroups: Record<string, ProfileWithStats[]> = {};
      const phoneGroups: Record<string, ProfileWithStats[]> = {};

      enrichedProfiles.forEach((profile) => {
        // CPF duplicates (normalize to digits only)
        if (profile.cpf_cnpj) {
          const normalizedCpf = profile.cpf_cnpj.replace(/\D/g, "");
          if (normalizedCpf.length >= 11) {
            if (!cpfGroups[normalizedCpf]) cpfGroups[normalizedCpf] = [];
            cpfGroups[normalizedCpf].push(profile);
          }
        }

        // Email duplicates (normalize to lowercase)
        if (profile.email) {
          const normalizedEmail = profile.email.toLowerCase().trim();
          if (!emailGroups[normalizedEmail])
            emailGroups[normalizedEmail] = [];
          emailGroups[normalizedEmail].push(profile);
        }

        // Phone duplicates (normalize to digits only)
        if (profile.phone) {
          const normalizedPhone = profile.phone.replace(/\D/g, "");
          if (normalizedPhone.length >= 10) {
            if (!phoneGroups[normalizedPhone])
              phoneGroups[normalizedPhone] = [];
            phoneGroups[normalizedPhone].push(profile);
          }
        }
      });

      // Build duplicate groups (only groups with 2+ profiles)
      const groups: DuplicateGroup[] = [];
      const processedProfileIds = new Set<string>();

      // CPF duplicates (highest priority)
      Object.entries(cpfGroups).forEach(([cpf, profs]) => {
        if (profs.length > 1) {
          groups.push({
            key: `cpf-${cpf}`,
            type: "cpf",
            profiles: profs,
          });
          profs.forEach((p) => processedProfileIds.add(p.id));
        }
      });

      // Email duplicates (exclude already processed)
      Object.entries(emailGroups).forEach(([email, profs]) => {
        const unprocessed = profs.filter(
          (p) => !processedProfileIds.has(p.id)
        );
        if (unprocessed.length > 1) {
          groups.push({
            key: `email-${email}`,
            type: "email",
            profiles: unprocessed,
          });
          unprocessed.forEach((p) => processedProfileIds.add(p.id));
        }
      });

      // Phone duplicates (exclude already processed)
      Object.entries(phoneGroups).forEach(([phone, profs]) => {
        const unprocessed = profs.filter(
          (p) => !processedProfileIds.has(p.id)
        );
        if (unprocessed.length > 1) {
          groups.push({
            key: `phone-${phone}`,
            type: "phone",
            profiles: unprocessed,
          });
        }
      });

      setDuplicateGroups(groups);

      // Auto-select master for each group (the one with most data)
      const defaultSelections: Record<string, string> = {};
      groups.forEach((group) => {
        const bestProfile = group.profiles.reduce((best, current) => {
          const currentScore =
            current.processCount * 3 +
            current.contractCount * 2 +
            current.invoiceCount;
          const bestScore =
            best.processCount * 3 + best.contractCount * 2 + best.invoiceCount;
          return currentScore > bestScore ? current : best;
        });
        defaultSelections[group.key] = bestProfile.id;
      });
      setSelectedMaster(defaultSelections);

      if (groups.length > 0) {
        setActiveGroup(groups[0].key);
      }
    } catch (error) {
      console.error("Error finding duplicates:", error);
      toast.error("Erro ao buscar duplicados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      findDuplicates();
    }
  }, [open, findDuplicates]);

  const handleMerge = async (groupKey: string) => {
    const group = duplicateGroups.find((g) => g.key === groupKey);
    if (!group) return;

    const masterId = selectedMaster[groupKey];
    if (!masterId) {
      toast.error("Selecione o perfil principal");
      return;
    }

    const duplicateIds = group.profiles
      .filter((p) => p.id !== masterId)
      .map((p) => p.id);

    if (duplicateIds.length === 0) {
      toast.error("Nenhum duplicado para mesclar");
      return;
    }

    setMerging(true);
    try {
      // Merge each duplicate into master using database function
      for (const duplicateId of duplicateIds) {
        const { error } = await supabase.rpc("merge_duplicate_clients", {
          keep_id: masterId,
          merge_id: duplicateId,
        });

        if (error) {
          console.error("Error merging:", error);
          throw error;
        }
      }

      toast.success(
        `${duplicateIds.length} perfil(is) mesclado(s) com sucesso!`
      );

      // Remove this group from the list
      setDuplicateGroups((prev) => prev.filter((g) => g.key !== groupKey));

      // Set next active group
      const remainingGroups = duplicateGroups.filter((g) => g.key !== groupKey);
      if (remainingGroups.length > 0) {
        setActiveGroup(remainingGroups[0].key);
      } else {
        setActiveGroup(null);
      }

      onMergeComplete?.();
    } catch (error) {
      console.error("Error merging duplicates:", error);
      toast.error("Erro ao mesclar duplicados");
    } finally {
      setMerging(false);
    }
  };

  const getDuplicateTypeLabel = (type: "cpf" | "email" | "phone") => {
    switch (type) {
      case "cpf":
        return { label: "CPF/CNPJ", icon: CreditCard, color: "bg-red-100 text-red-700" };
      case "email":
        return { label: "E-mail", icon: Mail, color: "bg-blue-100 text-blue-700" };
      case "phone":
        return { label: "Telefone", icon: Phone, color: "bg-green-100 text-green-700" };
    }
  };

  const activeGroupData = duplicateGroups.find((g) => g.key === activeGroup);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Users className="w-4 h-4 mr-2" />
            Duplicados
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="w-5 h-5" />
            Gerenciar Clientes Duplicados
          </DialogTitle>
          <DialogDescription>
            Identifique e unifique clientes duplicados para manter o CRM
            organizado.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">
              Analisando duplicados...
            </span>
          </div>
        ) : duplicateGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Check className="w-16 h-16 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Nenhum duplicado encontrado!
            </h3>
            <p className="text-muted-foreground max-w-md">
              Todos os clientes estão únicos no sistema. Continue monitorando
              para manter a qualidade dos dados.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={findDuplicates}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Verificar novamente
            </Button>
          </div>
        ) : (
          <div className="flex-1 flex gap-4 min-h-0">
            {/* Left sidebar - Group list */}
            <div className="w-64 flex-shrink-0 border-r pr-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-sm">
                  Grupos ({duplicateGroups.length})
                </h4>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={findDuplicates}
                  disabled={loading}
                >
                  <RefreshCw
                    className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {duplicateGroups.map((group) => {
                    const typeInfo = getDuplicateTypeLabel(group.type);
                    const TypeIcon = typeInfo.icon;
                    return (
                      <button
                        key={group.key}
                        onClick={() => setActiveGroup(group.key)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          activeGroup === group.key
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={`text-xs ${typeInfo.color}`}>
                            <TypeIcon className="w-3 h-3 mr-1" />
                            {typeInfo.label}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {group.profiles.length}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium truncate">
                          {group.profiles[0]?.full_name || "Sem nome"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {group.type === "cpf"
                            ? group.profiles[0]?.cpf_cnpj
                            : group.type === "email"
                            ? group.profiles[0]?.email
                            : group.profiles[0]?.phone}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Right content - Selected group detail */}
            <div className="flex-1 min-h-0">
              {activeGroupData ? (
                <div className="h-full flex flex-col">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <h4 className="font-medium">
                      {activeGroupData.profiles.length} perfis duplicados
                    </h4>
                  </div>

                  <p className="text-sm text-muted-foreground mb-4">
                    Selecione o perfil <strong>principal</strong> que será
                    mantido. Os dados dos outros perfis serão migrados para
                    ele.
                  </p>

                  <ScrollArea className="flex-1">
                    <RadioGroup
                      value={selectedMaster[activeGroupData.key]}
                      onValueChange={(value) =>
                        setSelectedMaster((prev) => ({
                          ...prev,
                          [activeGroupData.key]: value,
                        }))
                      }
                      className="space-y-3"
                    >
                      {activeGroupData.profiles.map((profile) => {
                        const isSelected =
                          selectedMaster[activeGroupData.key] === profile.id;
                        return (
                          <div
                            key={profile.id}
                            className={`relative p-4 rounded-lg border-2 transition-all ${
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-muted-foreground/50"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <RadioGroupItem
                                value={profile.id}
                                id={profile.id}
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0">
                                <Label
                                  htmlFor={profile.id}
                                  className="flex items-center gap-2 cursor-pointer"
                                >
                                  <span className="font-semibold">
                                    {profile.full_name || "Sem nome"}
                                  </span>
                                  {isSelected && (
                                    <Badge className="bg-primary text-primary-foreground">
                                      Principal
                                    </Badge>
                                  )}
                                </Label>

                                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Mail className="w-3 h-3" />
                                    <span className="truncate">
                                      {profile.email}
                                    </span>
                                  </div>
                                  {profile.phone && (
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <Phone className="w-3 h-3" />
                                      <span>{profile.phone}</span>
                                    </div>
                                  )}
                                  {profile.cpf_cnpj && (
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <CreditCard className="w-3 h-3" />
                                      <span>{profile.cpf_cnpj}</span>
                                    </div>
                                  )}
                                  {profile.company_name && (
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <Building className="w-3 h-3" />
                                      <span className="truncate">
                                        {profile.company_name}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <Separator className="my-2" />

                                <div className="flex items-center gap-4 text-xs">
                                  <div className="flex items-center gap-1">
                                    <FileText className="w-3 h-3 text-blue-500" />
                                    <span>
                                      {profile.processCount} processo(s)
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <FileText className="w-3 h-3 text-green-500" />
                                    <span>
                                      {profile.contractCount} contrato(s)
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <FileText className="w-3 h-3 text-amber-500" />
                                    <span>
                                      {profile.invoiceCount} fatura(s)
                                    </span>
                                  </div>
                                </div>

                                {profile.created_at && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Criado{" "}
                                    {formatDistanceToNow(
                                      new Date(profile.created_at),
                                      { addSuffix: true, locale: ptBR }
                                    )}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </RadioGroup>
                  </ScrollArea>

                  <Separator className="my-4" />

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      <AlertTriangle className="w-4 h-4 inline mr-1 text-amber-500" />
                      Esta ação é irreversível
                    </p>
                    <Button
                      onClick={() => handleMerge(activeGroupData.key)}
                      disabled={
                        merging || !selectedMaster[activeGroupData.key]
                      }
                    >
                      {merging ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Merge className="w-4 h-4 mr-2" />
                      )}
                      Mesclar Perfis
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Selecione um grupo à esquerda
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { usePermissions } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/format";
import {
  ArchiveRestore,
  CheckCircle2,
  Cloud,
  Download,
  FileUp,
  HardDriveDownload,
  History,
  Loader2,
  RefreshCw,
  ShieldAlert,
  UploadCloud,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Restricted } from "./AuditLog";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
const frequencyOptions = [
  { hours: 6, label: "Toutes les 6 heures" },
  { hours: 12, label: "Toutes les 12 heures" },
  { hours: 24, label: "Toutes les 24 heures" },
  { hours: 48, label: "Toutes les 48 heures" },
  { hours: 168, label: "Chaque semaine" },
];

export default function Backups() {
  const { can } = usePermissions();
  const utils = trpc.useUtils();
  const isAdmin = can("backups.manage");
  const { data, isLoading } = trpc.backups.get.useQuery(undefined, {
    enabled: isAdmin,
  });
  const [frequencyHours, setFrequencyHours] = useState<number>(24);
  const [retentionCount, setRetentionCount] = useState(14);
  const [automaticEnabled, setAutomaticEnabled] = useState(true);
  const [restoreDataUrl, setRestoreDataUrl] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const settings = data?.settings;
  useEffect(() => {
    if (settings && !settingsLoaded) {
      setFrequencyHours(settings.frequencyHours);
      setRetentionCount(settings.retentionCount);
      setAutomaticEnabled(settings.automaticEnabled);
      setSettingsLoaded(true);
    }
  }, [settings, settingsLoaded]);
  const invalidate = () => utils.backups.get.invalidate();
  const saveConfiguration = trpc.backups.saveConfiguration.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Planification de sauvegarde enregistrée.");
    },
    onError: error => toast.error(error.message),
  });
  const runNow = trpc.backups.runNow.useMutation({
    onSuccess: archive => {
      invalidate();
      toast.success(`Sauvegarde ${archive.filename} créée.`);
    },
    onError: error => toast.error(error.message),
  });
  const download = trpc.backups.download.useMutation({
    onSuccess: ({ url }) => window.open(url, "_blank", "noopener,noreferrer"),
    onError: error => toast.error(error.message),
  });
  const previewRestore = trpc.backups.previewRestore.useMutation({
    onSuccess: () =>
      toast.success(
        "Archive vérifiée. Confirmez la restauration si vous souhaitez continuer."
      ),
    onError: error => {
      setRestoreDataUrl(null);
      toast.error(error.message);
    },
  });
  const restore = trpc.backups.restore.useMutation({
    onSuccess: result => {
      setRestoreDataUrl(null);
      setConfirmation("");
      invalidate();
      toast.success(`${result.restoredCount} enregistrements restaurés.`);
      window.location.assign("/");
    },
    onError: error => toast.error(error.message),
  });
  if (!isAdmin)
    return (
      <Restricted
        title="Sauvegardes"
        description="La sauvegarde et la restauration des données sont réservées aux administrateurs."
      />
    );
  const activeSettings = settings ?? {
    automaticEnabled: true,
    frequencyHours: 24,
    retentionCount: 14,
    googleDriveConfigured: false,
    googleDriveConnected: false,
    scheduleNextAt: null,
    lastBackupAt: null,
    lastBackupStatus: "idle" as const,
    lastBackupError: null,
    googleDriveFolderId: null,
  };
  const currentFrequency = frequencyHours;
  const currentRetention = retentionCount;
  const currentAutomatic = automaticEnabled;
  const onRestoreFile = (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json"))
      return toast.error("Choisissez une archive JSON StockPilot.");
    if (file.size > 20 * 1024 * 1024)
      return toast.error("L’archive ne doit pas dépasser 20 Mo.");
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setRestoreDataUrl(dataUrl);
      previewRestore.mutate({ dataUrl });
    };
    reader.readAsDataURL(file);
  };
  const preview = previewRestore.data;
  const sellerManualArchives =
    data?.archives.filter(
      archive =>
        archive.trigger === "manual" && archive.createdByRole === "seller"
    ) ?? [];
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Protection des données
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
            Sauvegardes
          </h1>
        </div>
        <Button
          onClick={() => runNow.mutate()}
          disabled={runNow.isPending}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <HardDriveDownload className="mr-2 h-4 w-4" />
          {runNow.isPending ? "Sauvegarde…" : "Sauvegarder maintenant"}
        </Button>
      </header>
      <div className="grid gap-4 lg:grid-cols-3">
        <StatusCard
          icon={History}
          label="Dernière sauvegarde"
          value={
            activeSettings.lastBackupAt
              ? formatDate(activeSettings.lastBackupAt, true)
              : "Aucune"
          }
          detail={
            activeSettings.lastBackupStatus === "failed"
              ? activeSettings.lastBackupError || "Échec à vérifier"
              : activeSettings.lastBackupStatus === "success"
                ? "Archive disponible"
                : "En attente"
          }
          tone={activeSettings.lastBackupStatus === "failed" ? "rose" : "cyan"}
        />
        <StatusCard
          icon={RefreshCw}
          label="Automatisation"
          value={
            currentAutomatic ? `Toutes les ${currentFrequency} h` : "Désactivée"
          }
          detail={
            activeSettings.scheduleNextAt
              ? `Prochaine : ${formatDate(activeSettings.scheduleNextAt, true)}`
              : "À activer après enregistrement"
          }
          tone={currentAutomatic ? "cyan" : "slate"}
        />
        <StatusCard
          icon={Cloud}
          label="Google Drive"
          value={
            activeSettings.googleDriveConnected
              ? "Connecté"
              : activeSettings.googleDriveConfigured
                ? "Prêt à connecter"
                : "À configurer"
          }
          detail={
            activeSettings.googleDriveConnected
              ? "Copies cloud automatiques"
              : "Connexion requise"
          }
          tone={activeSettings.googleDriveConnected ? "green" : "slate"}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <Card className="border-border bg-card">
          <CardContent className="space-y-6 p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <RefreshCw className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold text-foreground">
                  Planification automatique
                </h2>
                <p className="text-sm text-faint">
                  La fréquence initiale est de 24 heures et peut être ajustée.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/50 p-4">
              <div>
                <p className="font-medium text-foreground">
                  Sauvegardes automatiques
                </p>
                <p className="mt-1 text-sm text-faint">
                  Archive locale et copie Drive après connexion.
                </p>
              </div>
              <Switch
                checked={currentAutomatic}
                onCheckedChange={setAutomaticEnabled}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-muted-foreground">
                <span>Fréquence</span>
                <select
                  value={currentFrequency}
                  onChange={event =>
                    setFrequencyHours(Number(event.target.value))
                  }
                  className="h-10 rounded-md border border-border bg-muted/50 px-3 text-sm text-foreground outline-none focus:border-primary"
                >
                  {frequencyOptions.map(option => (
                    <option key={option.hours} value={option.hours}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-muted-foreground">
                <span>Archives à conserver</span>
                <Input
                  type="number"
                  min={3}
                  max={90}
                  value={currentRetention}
                  onChange={event =>
                    setRetentionCount(Number(event.target.value) || 14)
                  }
                />
              </label>
            </div>
            <Button
              onClick={() =>
                saveConfiguration.mutate({
                  automaticEnabled: currentAutomatic,
                  frequencyHours: currentFrequency as 6 | 12 | 24 | 48 | 168,
                  retentionCount: currentRetention,
                  googleDriveFolderId: activeSettings.googleDriveFolderId,
                })
              }
              disabled={saveConfiguration.isPending}
              variant="outline"
              className="border-border text-foreground"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {saveConfiguration.isPending
                ? "Enregistrement…"
                : "Enregistrer la planification"}
            </Button>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card className="border-border bg-card">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-info-soft text-info">
                  <Cloud className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-semibold text-foreground">
                    Google Drive
                  </h2>
                  <p className="text-sm text-faint">
                    Copie cloud sécurisée des archives.
                  </p>
                </div>
              </div>
              {activeSettings.googleDriveConfigured ? (
                <Button
                  onClick={() =>
                    window.location.assign(
                      "/api/integrations/google-drive/connect"
                    )
                  }
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <UploadCloud className="mr-2 h-4 w-4" />
                  {activeSettings.googleDriveConnected
                    ? "Reconnecter Google Drive"
                    : "Connecter Google Drive"}
                </Button>
              ) : (
                <div className="rounded-xl border border-warning/25 bg-warning-soft p-3 text-sm text-warning">
                  Ajoutez les identifiants OAuth Google Drive dans les secrets
                  du projet pour activer cette connexion.
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="border-warning/25 bg-warning-soft">
            <CardContent className="flex gap-3 p-5">
              <ShieldAlert className="h-5 w-5 shrink-0 text-warning" />
              <p className="text-sm leading-6 text-warning">
                La restauration remplace les données métier actuelles par celles
                de l’archive choisie. Créez une sauvegarde récente avant de
                restaurer.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      <Card className="border-border bg-card">
        <CardContent className="p-6">
          <div className="mb-5 flex items-center gap-3">
            <ArchiveRestore className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">
              Restauration locale
            </h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/50 p-4 text-center">
              <FileUp className="mb-2 h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-foreground">
                Choisir une archive JSON
              </span>
              <span className="mt-1 text-xs text-faint">
                Archive StockPilot · 20 Mo maximum
              </span>
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={event => onRestoreFile(event.target.files?.[0])}
              />
            </label>
            <div className="rounded-xl border border-border bg-muted/50 p-4">
              {previewRestore.isPending ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Vérification de
                  l’archive…
                </div>
              ) : preview ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    <span className="text-faint">Archive exportée le </span>
                    {formatDate(preview.exportedAt, true)}{" "}
                    <span className="text-faint">· </span>
                    {preview.total} enregistrements
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      value={confirmation}
                      onChange={event => setConfirmation(event.target.value)}
                      placeholder="Tapez RESTAURER pour confirmer"
                    />
                    <Button
                      disabled={
                        confirmation !== "RESTAURER" ||
                        restore.isPending ||
                        !restoreDataUrl
                      }
                      onClick={() =>
                        restoreDataUrl &&
                        restore.mutate({
                          dataUrl: restoreDataUrl,
                          confirmation: "RESTAURER",
                        })
                      }
                      variant="destructive"
                    >
                      {restore.isPending ? "Restauration…" : "Restaurer"}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-faint">
                  Importez une archive pour en vérifier le contenu avant toute
                  restauration.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="border-border bg-card">
        <CardContent className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserRound className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-foreground">
                Sauvegardes manuelles des vendeurs
              </h2>
            </div>
            <Badge className="border-0 bg-primary/10 text-primary">
              {sellerManualArchives.length}
            </Badge>
          </div>
          {isLoading ? (
            <div className="py-6 text-sm text-faint">Chargement…</div>
          ) : sellerManualArchives.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {sellerManualArchives.map(archive => (
                <div
                  key={archive.id}
                  className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {archive.createdByName || "Vendeur non identifié"}
                      </p>
                      <p className="mt-1 text-xs text-faint">
                        {formatDate(archive.createdAt, true)}
                      </p>
                    </div>
                    <Badge
                      className={
                        archive.status === "completed"
                          ? "border-0 bg-success-soft text-success"
                          : "border-0 bg-destructive-soft text-destructive"
                      }
                    >
                      {archive.status === "completed" ? "Réussie" : "Échec"}
                    </Badge>
                  </div>
                  <p className="mt-3 truncate text-xs text-muted-foreground">
                    {archive.filename}
                  </p>
                  <p className="mt-1 text-xs text-faint">
                    {formatBytes(archive.sizeBytes)} · {archive.recordCount}{" "}
                    enregistrements
                  </p>
                  {archive.error && (
                    <p className="mt-2 text-xs text-destructive">
                      {archive.error}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-faint">
              Aucune sauvegarde manuelle réalisée par un vendeur.
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="border-border bg-card">
        <CardContent className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <History className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-foreground">
                Historique des archives
              </h2>
            </div>
            <Badge className="border-0 bg-muted text-muted-foreground">
              {data?.archives.length ?? 0}
            </Badge>
          </div>
          {isLoading ? (
            <div className="py-6 text-sm text-faint">Chargement…</div>
          ) : data?.archives.length ? (
            <div className="divide-y divide-border">
              {data.archives.map(archive => (
                <div
                  key={archive.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {archive.filename}
                    </p>
                    <p className="mt-1 text-xs text-faint">
                      {formatDate(archive.createdAt, true)} ·{" "}
                      {formatBytes(archive.sizeBytes)} · {archive.recordCount}{" "}
                      enregistrements ·{" "}
                      {archive.trigger === "scheduled"
                        ? "Automatique"
                        : "Manuelle"}
                      {archive.trigger === "manual" && archive.createdByName
                        ? ` · par ${archive.createdByName}`
                        : ""}
                    </p>
                  </div>
                  {archive.status === "completed" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => download.mutate({ id: archive.id })}
                      disabled={download.isPending}
                      className="border-border text-foreground"
                    >
                      <Download className="mr-2 h-3.5 w-3.5" />
                      Télécharger
                    </Button>
                  ) : (
                    <Badge variant="destructive">Échec</Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-sm text-faint">
              Aucune archive n’a encore été créée.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof History;
  label: string;
  value: string;
  detail: string;
  tone: "cyan" | "green" | "rose" | "slate";
}) {
  const tones = {
    cyan: "bg-primary/10 text-primary",
    green: "bg-success-soft text-success",
    rose: "bg-destructive-soft text-destructive",
    slate: "bg-muted text-muted-foreground",
  };
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-5">
        <span
          className={`mb-4 grid h-9 w-9 place-items-center rounded-xl ${tones[tone]}`}
        >
          <Icon className="h-4.5 w-4.5" />
        </span>
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-faint">
          {label}
        </p>
        <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
        <p className="mt-1 text-xs text-faint">{detail}</p>
      </CardContent>
    </Card>
  );
}

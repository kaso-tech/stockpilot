import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Boxes } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";

function tokenFromUrl() {
  return new URLSearchParams(window.location.search).get("token") ?? "";
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-2xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Boxes className="h-6 w-6" />
          </div>
          <p className="text-lg font-semibold tracking-tight">StockPilot</p>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-6 space-y-4">{children}</div>
        <Link
          href="/"
          className="mt-6 block text-center text-sm text-primary hover:underline"
        >
          Retour à la connexion
        </Link>
      </div>
    </div>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const request = trpc.auth.requestPasswordReset.useMutation();
  return (
    <Shell title="Mot de passe oublié">
      {request.isSuccess ? (
        <p className="text-sm text-muted-foreground" role="status">
          Si un compte correspond à cette adresse, un e-mail contenant un lien
          de réinitialisation (valable 1 heure) vient d’être envoyé.
        </p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={event => {
            event.preventDefault();
            request.mutate({ email });
          }}
        >
          <p className="text-sm text-muted-foreground">
            Indiquez l’adresse e-mail de votre compte : nous vous enverrons un
            lien pour choisir un nouveau mot de passe.
          </p>
          <Input
            type="email"
            autoComplete="email"
            placeholder="Adresse e-mail"
            value={email}
            onChange={event => setEmail(event.target.value)}
            className="border-border bg-muted/50"
          />
          <Button
            type="submit"
            disabled={!email || request.isPending}
            className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {request.isPending ? "Envoi…" : "Recevoir le lien"}
          </Button>
          {request.error && (
            <p className="text-center text-xs text-destructive">
              {request.error.message}
            </p>
          )}
        </form>
      )}
    </Shell>
  );
}

export function ResetPassword() {
  const [token] = useState(tokenFromUrl);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const reset = trpc.auth.resetPassword.useMutation();
  const mismatch = confirmation.length > 0 && confirmation !== password;
  return (
    <Shell title="Nouveau mot de passe">
      {reset.isSuccess ? (
        <p className="text-sm text-muted-foreground" role="status">
          Votre mot de passe a été modifié. Toutes vos sessions ont été fermées
          : connectez-vous avec le nouveau mot de passe.
        </p>
      ) : !token ? (
        <p className="text-sm text-destructive">
          Lien incomplet. Ouvrez le lien reçu par e-mail ou demandez-en un
          nouveau.
        </p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={event => {
            event.preventDefault();
            if (!mismatch) reset.mutate({ token, password });
          }}
        >
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="Nouveau mot de passe (10 caractères minimum)"
            value={password}
            onChange={event => setPassword(event.target.value)}
            className="border-border bg-muted/50"
          />
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="Confirmation"
            value={confirmation}
            onChange={event => setConfirmation(event.target.value)}
            className="border-border bg-muted/50"
          />
          {mismatch && (
            <p className="text-xs text-destructive">
              Les deux mots de passe ne correspondent pas.
            </p>
          )}
          <Button
            type="submit"
            disabled={password.length < 10 || mismatch || reset.isPending}
            className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {reset.isPending
              ? "Enregistrement…"
              : "Enregistrer le mot de passe"}
          </Button>
          {reset.error && (
            <p className="text-center text-xs text-destructive">
              {reset.error.message}{" "}
              <Link href="/mot-de-passe-oublie" className="underline">
                Demander un nouveau lien
              </Link>
            </p>
          )}
        </form>
      )}
    </Shell>
  );
}

export function VerifyEmail() {
  const [token] = useState(tokenFromUrl);
  const verify = trpc.auth.verifyEmail.useMutation();
  const started = useRef(false);
  useEffect(() => {
    if (token && !started.current) {
      started.current = true;
      verify.mutate({ token });
    }
  }, [token, verify]);
  return (
    <Shell title="Vérification de l’adresse e-mail">
      <p className="text-sm text-muted-foreground" role="status">
        {!token
          ? "Lien incomplet : ouvrez le lien reçu par e-mail."
          : verify.isSuccess
            ? "Merci, votre adresse e-mail est confirmée."
            : verify.error
              ? verify.error.message
              : "Vérification en cours…"}
      </p>
    </Shell>
  );
}

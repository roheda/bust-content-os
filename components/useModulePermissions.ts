"use client";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  PlatformUser,
  PermissionAction,
  canUser,
  findUserByAuth,
  listUsers,
} from "@/lib/data";

const authEnforced = process.env.NEXT_PUBLIC_AUTH_ENFORCED !== "false";
const demoLoginAllowed = !authEnforced && process.env.NODE_ENV !== "production";

export function useActivePlatformUser() {
  const [activeUser, setActiveUser] = useState<PlatformUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadDemoUser() {
      try {
        const users = await listUsers();
        const saved = typeof window !== "undefined" ? window.localStorage.getItem("bust-active-user-id") : "";
        const selected = users.find((user) => user.id === saved) || users.find((user) => user.isMaster || user.roleKey === "master") || users[0] || null;
        if (mounted) setActiveUser(selected?.status === "active" ? selected : null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (demoLoginAllowed) {
      loadDemoUser();
      return () => {
        mounted = false;
      };
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;
      if (!firebaseUser) {
        setActiveUser(null);
        setLoading(false);
        return;
      }
      try {
        const profile = await findUserByAuth(firebaseUser.uid, firebaseUser.email || "");
        if (mounted) setActiveUser(profile?.status === "active" ? profile : null);
      } finally {
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return { activeUser, loading };
}

export function useModulePermissions(moduleKey: string) {
  const { activeUser, loading } = useActivePlatformUser();
  const can = useMemo(
    () => (action: PermissionAction = "view") => canUser(activeUser, moduleKey, action),
    [activeUser, moduleKey],
  );
  return {
    activeUser,
    loading,
    can,
    canView: can("view"),
    canCreate: can("create"),
    canEdit: can("edit"),
    canDelete: can("delete"),
    canApprove: can("approve"),
    canAssign: can("assign"),
    canGenerate: can("generate"),
    canConfigure: can("configure"),
  };
}

export function permissionAlert(actionLabel = "realizar esta acción") {
  alert(`No tienes permiso para ${actionLabel}. Solicita acceso a Dirección o Administración.`);
}

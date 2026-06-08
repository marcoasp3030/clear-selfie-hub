import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listUsers, updateUserRole, deleteUser } from "@/server/users.functions";
import { requireAdminAccessToken } from "@/lib/adminAccessToken";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MoreHorizontal, 
  UserPlus, 
  Shield, 
  User as UserIcon, 
  Trash2,
  Loader2,
  UserCheck
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const getUsersFn = useServerFn(listUsers);
  const updateRoleFn = useServerFn(updateUserRole);
  const deleteUserFn = useServerFn(deleteUser);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const accessToken = await requireAdminAccessToken();
      const data = await getUsersFn({ data: { accessToken } });
      setUsers(data);
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Erro ao carregar usuários");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleUpdateRole = async (userId: string, role: string) => {
    try {
      const accessToken = await requireAdminAccessToken();
      await updateRoleFn({ data: { accessToken, userId, role: role as any } });
      toast.success("Perfil atualizado com sucesso");
      loadUsers();
    } catch (error) {
      toast.error("Erro ao atualizar perfil");
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Tem certeza que deseja remover este usuário do sistema de administração?")) return;
    
    try {
      const accessToken = await requireAdminAccessToken();
      await deleteUserFn({ data: { accessToken, userId } });
      toast.success("Usuário removido");
      loadUsers();
    } catch (error) {
      toast.error("Erro ao remover usuário");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gerenciamento de Usuários</h1>
          <p className="text-muted-foreground">
            Administre quem tem acesso ao painel do sistema.
          </p>
        </div>
        <Button onClick={() => toast.info("Convide novos usuários através do painel do Supabase por enquanto.")} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Data de Cadastro</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                        {user.full_name?.charAt(0) || "U"}
                      </div>
                      <span className="font-medium">{user.full_name || "Sem nome"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={user.role} />
                  </TableCell>
                  <TableCell>
                    {user.created_at ? format(new Date(user.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Alterar Perfil</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleUpdateRole(user.id, "admin")} className="gap-2">
                          <Shield className="h-4 w-4 text-primary" />
                          Administrador
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUpdateRole(user.id, "employee")} className="gap-2">
                          <UserCheck className="h-4 w-4 text-blue-500" />
                          Funcionário
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUpdateRole(user.id, "user")} className="gap-2">
                          <UserIcon className="h-4 w-4 text-muted-foreground" />
                          Usuário Comum
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDelete(user.id)} className="gap-2 text-destructive focus:text-destructive">
                          <Trash2 className="h-4 w-4" />
                          Remover Acesso
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  switch (role) {
    case "admin":
      return (
        <Badge className="bg-primary hover:bg-primary/90">
          <Shield className="mr-1 h-3 w-3" />
          Administrador
        </Badge>
      );
    case "employee":
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100/80 border-blue-200">
          <UserCheck className="mr-1 h-3 w-3" />
          Funcionário
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          <UserIcon className="mr-1 h-3 w-3" />
          Usuário
        </Badge>
      );
  }
}

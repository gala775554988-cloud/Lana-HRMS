export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    const roles = (session.user.roles as string[]) || [];
    redirect(resolveRoleDashboard(roles));
  }
  
  // يتم عرض هذا الجزء فقط إذا لم يكن المستخدم مسجلاً للدخول
  return (
    <div>
      <h1>مرحباً بكم في لانا الطبية</h1>
    </div>
  );
}
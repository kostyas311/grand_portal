type NamedUser =
  | { id?: string | null; fullName?: string | null }
  | null
  | undefined;

export function displayUserName(
  user: NamedUser,
  currentUserId?: string | null,
  selfLabel = 'Вы',
) {
  if (!user?.fullName) {
    return '';
  }

  return user.id && currentUserId && user.id === currentUserId ? selfLabel : user.fullName;
}

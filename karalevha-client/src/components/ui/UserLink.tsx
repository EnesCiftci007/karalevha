import { Link } from 'react-router-dom';

/** Kullanıcı adını profil sayfasına bağlar. */
export default function UserLink({ username, className = '' }: { username: string; className?: string }) {
  if (!username || username === 'Bilinmeyen') return <span className={className}>{username || 'Bilinmeyen'}</span>;
  return (
    <Link to={`/u/${encodeURIComponent(username)}`} className={`hover:underline underline-offset-4 ${className}`}>
      {username}
    </Link>
  );
}

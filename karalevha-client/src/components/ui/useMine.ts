import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * "Benimkiler" süzgeci: adreste ?kimin=benim olarak durur, böylece ana sayfadaki rakamlardan
 * doğrudan süzülmüş liste açılabilir. Giriş yapılmamışsa süzgeç hiç çalışmaz.
 */
export function useMine(): [boolean, (on: boolean) => void] {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const mine = !!user && params.get('kimin') === 'benim';

  const setMine = useCallback(
    (on: boolean) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (on) next.set('kimin', 'benim');
          else next.delete('kimin');
          return next;
        },
        { replace: true }
      ),
    [setParams]
  );

  return [mine, setMine];
}

import { useState, useEffect, useCallback } from 'react';
import { AdCard } from './AdCard';
import { AdFilters } from './AdFilters';
import { Pagination } from '../ui/Pagination';
import { Spinner } from '../ui/Spinner';
import { Alert } from '../ui/Alert';
import { adApi, favoriteApi, authApi } from '../../lib/api';
import { getErrorMessage } from '../../lib/utils';

interface Ad {
  id: string;
  title: string;
  description: string;
  budgetMin: number | null;
  budgetMax: number | null;
  modality: string;
  location: string | null;
  status: string;
  createdAt: string;
  category: { id: string; name: string } | null;
  user: { id: string; fullName: string; avatarUrl: string | null; city: string | null } | null;
  images?: { id: string; imageUrl: string; isMain: boolean }[];
  applicationsCount?: number;
  isFavorited?: boolean;
}

interface AdListProps {
  initialFilters?: Record<string, string>;
  showFilters?: boolean;
  showFavoriteButton?: boolean;
  emptyMessage?: string;
}

export function AdList({
  initialFilters = {},
  showFilters = true,
  showFavoriteButton = false,
  emptyMessage = 'No se encontraron anuncios',
}: AdListProps) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 12,
    total: 0,
    totalPages: 0,
  });
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchAds = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      params.set('page', pagination.page.toString());
      params.set('pageSize', pagination.pageSize.toString());

      const response = await adApi.list(params);
      if (response.success) {
        setAds(response.data.items);
        setPagination((prev) => ({
          ...prev,
          total: response.data.total,
          totalPages: response.data.totalPages,
        }));
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [filters, pagination.page, pagination.pageSize]);

  useEffect(() => {
    // Hide favorite button for admin users
    (async () => {
      try {
        const res = await authApi.validate();
        if (res?.success && res.data?.user?.roles?.includes('admin')) {
          setIsAdmin(true);
        }
      } catch (err) {
        // ignore
      }
    })();
    fetchAds();
  }, [fetchAds]);

  const handleFilterChange = (newFilters: Record<string, string>) => {
    setFilters(newFilters);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFavoriteToggle = async (adId: string) => {
    try {
      const response = await favoriteApi.toggle(adId);
      if (response.success) {
        setAds((prev) =>
          prev.map((ad) =>
            ad.id === adId ? { ...ad, isFavorited: response.data.isFavorited } : ad
          )
        );
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  return (
    <div className="space-y-6">
      {showFilters && <AdFilters initialFilters={filters} onFilterChange={handleFilterChange} />}

      {error && (
        <Alert variant="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : ads.length === 0 ? (
        <div className="text-center py-12">
          <svg
            className="h-12 w-12 mx-auto text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className="mt-4 text-gray-600">{emptyMessage}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ads.map((ad) => (
              <AdCard
                key={ad.id}
                ad={ad}
                onFavoriteToggle={showFavoriteButton && !isAdmin ? handleFavoriteToggle : undefined}
              />
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}
    </div>
  );
}

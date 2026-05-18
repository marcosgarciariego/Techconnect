import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { formatCurrency, formatRelativeTime, getBudgetRange, getModalityLabel, getStatusColor } from '../../lib/utils';

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
  category: {
    id: string;
    name: string;
  } | null;
  user: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
    city: string | null;
  } | null;
  images?: { id: string; imageUrl: string; isMain: boolean }[];
  applicationsCount?: number;
  isFavorited?: boolean;
}

interface AdCardProps {
  ad: Ad;
  showStatus?: boolean;
  onFavoriteToggle?: (adId: string) => void;
}

export function AdCard({ ad, showStatus = false, onFavoriteToggle }: AdCardProps) {
  const mainImage = ad.images?.find((img) => img.isMain) || ad.images?.[0];

  return (
    <a
      href={`/anuncios/${ad.id}`}
      className="block bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 overflow-hidden"
    >
      {/* Image */}
      <div className="relative h-40 bg-gray-100">
        {mainImage ? (
          <img
            src={mainImage.imageUrl}
            alt={ad.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Favorite button */}
        {onFavoriteToggle && (
          <button
            onClick={(e) => {
              e.preventDefault();
              onFavoriteToggle(ad.id);
            }}
            className="absolute top-3 right-3 p-2 bg-white rounded-full shadow-md hover:scale-110 transition-transform"
          >
            <svg
              className={`h-5 w-5 ${ad.isFavorited ? 'text-red-500 fill-current' : 'text-gray-400'}`}
              fill={ad.isFavorited ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </button>
        )}

        {/* Status badge */}
        {showStatus && (
          <div className="absolute top-3 left-3">
            <Badge variant={getStatusColor(ad.status) as any}>
              {ad.status === 'active' ? 'Activo' : ad.status === 'closed' ? 'Cerrado' : ad.status}
            </Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Category */}
        {ad.category && (
          <span className="text-xs font-medium text-primary-600">{ad.category.name}</span>
        )}

        {/* Title */}
        <h3 className="mt-1 text-lg font-semibold text-gray-900 line-clamp-2">{ad.title}</h3>

        {/* Description */}
        <p className="mt-2 text-sm text-gray-600 line-clamp-2">{ad.description}</p>

        {/* Meta */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span className="inline-flex items-center">
            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            {ad.location || 'No especificada'}
          </span>
          <span>•</span>
          <span>{getModalityLabel(ad.modality)}</span>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {ad.user && (
              <>
                <Avatar src={ad.user.avatarUrl} name={ad.user.fullName} size="xs" />
                <span className="text-sm text-gray-600">{ad.user.fullName}</span>
              </>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-gray-900">
              {getBudgetRange(ad.budgetMin, ad.budgetMax)}
            </div>
            <div className="text-xs text-gray-500">{formatRelativeTime(ad.createdAt)}</div>
          </div>
        </div>

        {/* Applications count */}
        {ad.applicationsCount !== undefined && ad.applicationsCount > 0 && (
          <div className="mt-3 text-xs text-gray-500">
            {ad.applicationsCount} candidatura{ad.applicationsCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </a>
  );
}

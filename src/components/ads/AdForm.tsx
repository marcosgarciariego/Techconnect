import { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Alert } from '../ui/Alert';
import { categoryApi, adApi } from '../../lib/api';
import { getErrorMessage } from '../../lib/utils';

interface Category {
  id: string;
  name: string;
}

interface AdFormProps {
  initialData?: {
    id?: string;
    categoryId?: string;
    title?: string;
    description?: string;
    budgetMin?: number | null;
    budgetMax?: number | null;
    modality?: string;
    location?: string;
    status?: string;
  };
  onSuccess?: (ad: any) => void;
}

export function AdForm({ initialData, onSuccess }: AdFormProps) {
  const isEditing = !!initialData?.id;
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    categoryId: initialData?.categoryId || '',
    title: initialData?.title || '',
    description: initialData?.description || '',
    budgetMin: initialData?.budgetMin?.toString() || '',
    budgetMax: initialData?.budgetMax?.toString() || '',
    modality: initialData?.modality || 'online',
    location: initialData?.location || '',
    status: initialData?.status || 'active',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    categoryApi
      .list()
      .then((res) => {
        if (res.success) setCategories(res.data);
      })
      .catch((err) => {
        setError(getErrorMessage(err));
      });
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const categoryId = Number.parseInt(formData.categoryId, 10);
      const title = formData.title.trim();
      const description = formData.description.trim();
      const budgetMin = formData.budgetMin ? parseFloat(formData.budgetMin) : null;
      const budgetMax = formData.budgetMax ? parseFloat(formData.budgetMax) : null;

      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        throw new Error('Selecciona una categoria');
      }

      if (title.length < 5) {
        throw new Error('El titulo debe tener al menos 5 caracteres');
      }

      if (description.length < 20) {
        throw new Error('La descripcion debe tener al menos 20 caracteres');
      }

      if (budgetMin !== null && budgetMax !== null && budgetMax < budgetMin) {
        throw new Error('El presupuesto maximo debe ser mayor o igual al minimo');
      }

      const data = {
        categoryId,
        title,
        description,
        budgetMin,
        budgetMax,
        modality: formData.modality,
        location: formData.location.trim() || null,
        status: formData.status,
      };

      let response;
      if (isEditing) {
        response = await adApi.update(initialData!.id!, data);
      } else {
        response = await adApi.create(data);
      }

      if (response.success) {
        onSuccess?.(response.data);
        if (!isEditing) {
          window.location.href = '/dashboard/cliente/anuncios';
        }
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Categoría *</label>
        <select
          name="categoryId"
          value={formData.categoryId}
          onChange={handleChange}
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Selecciona una categoría</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      <Input
        label="Título *"
        name="title"
        value={formData.title}
        onChange={handleChange}
        placeholder="Ej: Desarrollo de tienda online"
        required
        minLength={5}
        maxLength={150}
      />

      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">Descripción *</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Describe detalladamente lo que necesitas..."
          required
          minLength={20}
          rows={5}
          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
        />
        <p className="mt-1 text-xs text-gray-500">Mínimo 20 caracteres</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Presupuesto mínimo (€)"
          type="number"
          name="budgetMin"
          value={formData.budgetMin}
          onChange={handleChange}
          placeholder="0"
          min="0"
          step="0.01"
        />

        <Input
          label="Presupuesto máximo (€)"
          type="number"
          name="budgetMax"
          value={formData.budgetMax}
          onChange={handleChange}
          placeholder="0"
          min="0"
          step="0.01"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Modalidad *</label>
          <select
            name="modality"
            value={formData.modality}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
          >
            <option value="online">Online</option>
            <option value="presencial">Presencial</option>
            <option value="hibrido">Híbrido</option>
          </select>
        </div>

        <Input
          label="Ubicación"
          name="location"
          value={formData.location}
          onChange={handleChange}
          placeholder="Ej: Madrid, España"
        />
      </div>

      {isEditing && (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Estado</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
          >
            <option value="draft">Borrador</option>
            <option value="active">Activo</option>
            <option value="closed">Cerrado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
      )}

      <div className="flex justify-end space-x-3">
        <Button type="button" variant="secondary" onClick={() => window.history.back()}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={isLoading}>
          {isEditing ? 'Guardar cambios' : 'Publicar anuncio'}
        </Button>
      </div>
    </form>
  );
}

import { useState } from 'react';
import Card from '../common/Card';
import Dropdown from '../common/Dropdown';
import { useData } from '../../context/DataContext';

const TYPE_OPTIONS = ['expense', 'income'];

const inputClass =
  'text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent hover:border-gray-300 transition-colors';

// ---------------------------------------------------------------------------
// SubCategory Row (child of a parent category)
// ---------------------------------------------------------------------------

function SubCategoryRow({ category, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  function handleSave() {
    if (name.trim() && name.trim() !== category.name) {
      onEdit(category.id, { name: name.trim() });
    }
    setEditing(false);
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    setDeleteError('');
    try {
      await onDelete(category.id);
      setConfirmDelete(false);
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete category.');
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="py-2.5 group">
      <div className="flex items-center gap-2">
      {editing ? (
        <>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') { setName(category.name); setEditing(false); }
            }}
            className={`flex-1 ${inputClass} !border-accent`}
          />
          <button
            onClick={handleSave}
            className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg font-semibold hover:bg-brand-hover transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => { setName(category.name); setEditing(false); }}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 font-medium transition-colors"
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <span className="flex-1 text-[13px] text-gray-500">{category.name}</span>
          <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-gray-400 hover:text-accent px-2 py-1 rounded-lg hover:bg-accent-light/30 font-medium transition-colors"
            >
              Edit
            </button>
            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="text-xs px-2.5 py-1 bg-brand text-white rounded-lg font-semibold hover:bg-brand-hover disabled:opacity-50 transition-colors"
                >
                  {deleting ? '...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-gray-400 hover:text-brand px-2 py-1 rounded-lg hover:bg-brand/10 font-medium transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </>
      )}
      </div>
      {deleteError && (
        <div className="mt-1.5 flex items-start gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-1.5">
          <span className="flex-1">{deleteError}</span>
          <button
            onClick={() => setDeleteError('')}
            className="text-rose-400 hover:text-rose-600 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category Row (parent-level, with nested subcategories)
// ---------------------------------------------------------------------------

function CategoryRow({ category, onEdit, onDelete, onAddSub, onEditSub, onDeleteSub }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Add subcategory form
  const [addingSub, setAddingSub] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [subAdding, setSubAdding] = useState(false);

  function handleSave() {
    if (name.trim() && name.trim() !== category.name) {
      onEdit(category.id, { name: name.trim() });
    }
    setEditing(false);
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    setDeleteError('');
    try {
      await onDelete(category.id);
      setConfirmDelete(false);
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete category.');
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  async function handleAddSub() {
    const trimmed = newSubName.trim();
    if (!trimmed) return;
    setSubAdding(true);
    await onAddSub({ name: trimmed, type: category.type, parent: category.id });
    setNewSubName('');
    setSubAdding(false);
    setAddingSub(false);
  }

  const children = category.children ?? [];

  return (
    <div className="py-2.5">
      {/* Parent row */}
      <div className="flex items-center gap-2 group">
        {editing ? (
          <>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') { setName(category.name); setEditing(false); }
              }}
              className={`flex-1 ${inputClass} !border-accent`}
            />
            <button
              onClick={handleSave}
              className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg font-semibold hover:bg-brand-hover transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => { setName(category.name); setEditing(false); }}
              className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 text-[13px] font-medium text-gray-700">{category.name}</span>
            {children.length > 0 && (
              <span className="text-[11px] text-gray-400 font-medium">{children.length} sub</span>
            )}
            <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-gray-400 hover:text-accent px-2 py-1 rounded-lg hover:bg-accent-light/30 font-medium transition-colors"
              >
                Edit
              </button>
              {category.role ? (
                <span
                  title="Cannot delete a protected category. Rename instead."
                  className="text-xs text-gray-300 px-2 py-1 cursor-not-allowed"
                >
                  Delete
                </span>
              ) : confirmDelete ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleConfirmDelete}
                    disabled={deleting}
                    className="text-xs px-2.5 py-1 bg-brand text-white rounded-lg font-semibold hover:bg-brand-hover disabled:opacity-50 transition-colors"
                  >
                    {deleting ? '...' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs text-gray-400 hover:text-brand px-2 py-1 rounded-lg hover:bg-brand/10 font-medium transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {deleteError && (
        <div className="mt-1.5 flex items-start gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-1.5">
          <span className="flex-1">{deleteError}</span>
          <button
            onClick={() => setDeleteError('')}
            className="text-rose-400 hover:text-rose-600 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Subcategories */}
      {children.length > 0 && (
        <div className="divide-y divide-gray-50 mt-1">
          {children.map((child) => (
            <SubCategoryRow
              key={child.id}
              category={child}
              onEdit={onEditSub}
              onDelete={onDeleteSub}
            />
          ))}
        </div>
      )}

      {/* Add subcategory */}
      {addingSub ? (
        <div className="mt-2 flex gap-2">
          <input
            autoFocus
            value={newSubName}
            onChange={(e) => setNewSubName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSub()}
            placeholder="Subcategory name"
            className={`flex-1 min-w-0 ${inputClass}`}
          />
          <button
            onClick={handleAddSub}
            disabled={subAdding}
            className="text-xs px-4 py-2 bg-brand text-white rounded-xl font-bold hover:bg-brand-hover disabled:opacity-50 transition-colors"
          >
            {subAdding ? '...' : 'Add'}
          </button>
          <button
            onClick={() => { setAddingSub(false); setNewSubName(''); }}
            className="text-xs px-4 py-2 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAddingSub(true)}
          className="mt-1 text-xs text-accent hover:text-brand font-semibold hover:bg-accent-light/30 px-2 py-1.5 -ml-2 rounded-lg transition-colors"
        >
          + Add Subcategory
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function CategoryManager() {
  const { categories, addCategory, updateCategory, deleteCategory } = useData();

  const [newName, setNewName]   = useState('');
  const [newType, setNewType]   = useState('expense');
  const [adding, setAdding]     = useState(false);
  const [error, setError]       = useState('');

  // Build hierarchy: top-level categories with their children nested.
  // Always build from the flat list so locally-added subcategories show up
  // immediately (the API-nested `children` field can be stale after dispatch).
  const topLevel = categories.filter((c) => !c.parent && !c.parent_id);
  const childrenMap = new Map();
  for (const cat of categories) {
    const parentId = cat.parent ?? cat.parent_id;
    if (parentId) {
      if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
      childrenMap.get(parentId).push(cat);
    }
  }
  const hierarchical = topLevel
    .map((cat) => ({
      ...cat,
      children: (childrenMap.get(cat.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const grouped = {
    expense: hierarchical.filter((c) => c.type === 'expense'),
    income:  hierarchical.filter((c) => c.type === 'income'),
  };

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) { setError('Name is required.'); return; }
    setError('');
    setAdding(true);
    await addCategory({ name: trimmed, type: newType });
    setNewName('');
    setAdding(false);
  }

  return (
    <div className="space-y-6">
      {/* Add new */}
      <Card className="p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Add Category</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Category name"
            className={`w-full sm:flex-1 sm:min-w-0 ${inputClass}`}
          />
          <div className="flex gap-2">
            <Dropdown
              value={newType}
              onChange={setNewType}
              options={TYPE_OPTIONS.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
              className="flex-1 sm:flex-none min-w-[120px]"
            />
            <button
              onClick={handleAdd}
              disabled={adding}
              className="text-sm px-5 py-2 bg-brand text-white rounded-xl font-bold hover:bg-brand-hover disabled:opacity-50 transition-colors"
            >
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-rose-500 font-medium mt-2">{error}</p>}
      </Card>

      {/* Grouped lists */}
      {TYPE_OPTIONS.map((type) => (
        <Card key={type} className="p-5">
          <div className="pb-3 border-b border-gray-100">
            <h3 className="text-base font-bold text-gray-800 capitalize">{type}</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {grouped[type].length} {grouped[type].length === 1 ? 'category' : 'categories'}
            </p>
          </div>
          <div className="mt-2">
            {grouped[type].length === 0 ? (
              <p className="text-sm text-gray-400 py-3">No {type} categories yet.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {grouped[type].map((cat) => (
                  <CategoryRow
                    key={cat.id}
                    category={cat}
                    onEdit={updateCategory}
                    onDelete={deleteCategory}
                    onAddSub={addCategory}
                    onEditSub={updateCategory}
                    onDeleteSub={deleteCategory}
                  />
                ))}
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

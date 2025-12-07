import { useState, FormEvent } from 'react';
import styles from './CreateProjectModal.module.css';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, description: string) => void;
}

export default function CreateProjectModal({ isOpen, onClose, onSubmit }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Project name is required');
      return;
    }

    onSubmit(trimmedName, description.trim());
    setName('');
    setDescription('');
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setError('');
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.title}>Create New Project</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="projectName" className={styles.label}>
              Project Name <span className={styles.required}>*</span>
            </label>
            <input
              id="projectName"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My Cinematic Project"
              className="input"
              autoFocus
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="projectDescription" className={styles.label}>
              Description
            </label>
            <textarea
              id="projectDescription"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of your project..."
              className="input textarea"
              rows={3}
            />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <button type="button" onClick={handleClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

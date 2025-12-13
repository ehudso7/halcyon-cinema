import Link from 'next/link';
import { PROJECT_TABS, getProjectTabHref, ProjectTabId } from '@/constants/navigation';
import styles from './ProjectNavigation.module.css';

interface ProjectNavigationProps {
  projectId: string;
  activeTab: ProjectTabId;
}

export default function ProjectNavigation({ projectId, activeTab }: ProjectNavigationProps) {
  return (
    <nav className={styles.projectNav}>
      {PROJECT_TABS.map(tab => (
        <Link
          key={tab.id}
          href={getProjectTabHref(projectId, tab.id)}
          className={`${styles.navTab} ${tab.id === activeTab ? styles.active : ''}`}
        >
          <span className={styles.navIcon}><tab.IconComponent size={18} /></span>
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}

import { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import Head from 'next/head';
import Link from 'next/link';
import Header from '@/components/Header';
import SceneSequencer from '@/components/SceneSequencer';
import VoiceoverPanel from '@/components/VoiceoverPanel';
import { Project, ShotBlock } from '@/types';
import { getProjectById } from '@/utils/storage';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import styles from '@/styles/Sequence.module.css';

const PROJECT_TABS = [
  { id: 'scenes', label: 'Scenes', icon: '🎬' },
  { id: 'lore', label: 'World Lore', icon: '📚' },
  { id: 'characters', label: 'Characters', icon: '👤' },
  { id: 'sequence', label: 'Scene Flow', icon: '🎞️' },
];

interface SequencePageProps {
  project: Project;
}

export default function SequencePage({ project }: SequencePageProps) {
  const [voiceoverText, setVoiceoverText] = useState('');
  const [showVoiceover, setShowVoiceover] = useState(false);

  const handleSaveSequence = async (shots: ShotBlock[]) => {
    // In a full implementation, this would save to the API
    console.log('Saving sequence:', shots);
    alert('Sequence saved! (Demo mode)');
  };

  const handleExportScript = (shots: ShotBlock[]) => {
    // Generate a simple screenplay format
    let script = `# ${project.name}\n\n`;
    script += `## Scene Sequence\n\n`;

    shots.forEach((shot, index) => {
      const scene = project.scenes.find(s => s.id === shot.sceneId);
      if (scene) {
        script += `### ${shot.title || `Scene ${index + 1}`}\n\n`;
        script += `**Duration:** ${shot.duration}s\n`;
        script += `**Transition:** ${shot.transitionType?.toUpperCase() || 'CUT'}\n\n`;
        script += `${scene.prompt}\n\n`;
        script += `---\n\n`;
      }
    });

    // Download as markdown file
    const blob = new Blob([script], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.toLowerCase().replace(/\s+/g, '-')}-script.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Generate default narration text from scenes
  useEffect(() => {
    if (project.scenes.length > 0) {
      const narration = project.scenes
        .map((scene, i) => `Scene ${i + 1}: ${scene.prompt.slice(0, 100)}...`)
        .join('\n\n');
      setVoiceoverText(narration);
    }
  }, [project.scenes]);

  return (
    <>
      <Head>
        <title>Scene Flow | {project.name} | HALCYON-Cinema</title>
      </Head>

      <Header showBackLink backLinkHref="/" backLinkText="Projects" />

      <main className="page">
        <div className="container">
          <div className={styles.header}>
            <div className={styles.headerInfo}>
              <h1 className={styles.title}>{project.name}</h1>
              <p className={styles.meta}>
                {project.scenes.length} {project.scenes.length === 1 ? 'scene' : 'scenes'} available
              </p>
            </div>
          </div>

          <nav className={styles.projectNav}>
            {PROJECT_TABS.map(tab => {
              const href = tab.id === 'scenes'
                ? `/project/${project.id}`
                : `/project/${project.id}/${tab.id}`;
              const isActive = tab.id === 'sequence';

              return (
                <Link
                  key={tab.id}
                  href={href}
                  className={`${styles.navTab} ${isActive ? styles.active : ''}`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </nav>

          {project.scenes.length > 0 ? (
            <div className={styles.content}>
              <SceneSequencer
                scenes={project.scenes}
                onSave={handleSaveSequence}
                onExport={handleExportScript}
              />

              <div className={styles.voiceoverSection}>
                <button
                  className={styles.voiceoverToggle}
                  onClick={() => setShowVoiceover(!showVoiceover)}
                >
                  {showVoiceover ? '🎙️ Hide Voiceover Panel' : '🎙️ Add Voiceover'}
                </button>

                {showVoiceover && (
                  <VoiceoverPanel
                    text={voiceoverText}
                    onTextChange={setVoiceoverText}
                    sceneTitle="Full Sequence"
                  />
                )}
              </div>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🎞️</div>
              <h3>No scenes to sequence</h3>
              <p>Create some scenes first, then arrange them into your narrative flow.</p>
              <Link href={`/project/${project.id}`} className="btn btn-primary">
                Go to Scenes
              </Link>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<SequencePageProps> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session?.user?.id) {
    return {
      redirect: {
        destination: '/auth/signin',
        permanent: false,
      },
    };
  }

  const projectId = context.params?.projectId as string;
  const project = getProjectById(projectId);

  if (!project) {
    return { notFound: true };
  }

  if (project.userId && project.userId !== session.user.id) {
    return { notFound: true };
  }

  return {
    props: { project },
  };
};

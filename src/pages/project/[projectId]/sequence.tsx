import { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import Head from 'next/head';
import Link from 'next/link';
import Header from '@/components/Header';
import Breadcrumb from '@/components/Breadcrumb';
import ProjectNavigation from '@/components/ProjectNavigation';
import SceneSequencer from '@/components/SceneSequencer';
import VoiceoverPanel from '@/components/VoiceoverPanel';
import { useToast } from '@/components/Toast';
import { Project, ShotBlock } from '@/types';
import { getProjectByIdAsync } from '@/utils/storage';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import styles from '@/styles/Sequence.module.css';

interface SequencePageProps {
  project: Project;
}

export default function SequencePage({ project: initialProject }: SequencePageProps) {
  const [project, setProject] = useState(initialProject);
  const [voiceoverText, setVoiceoverText] = useState('');
  const [showVoiceover, setShowVoiceover] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { showSuccess, showError } = useToast();

  const handleSaveSequence = async (shots: ShotBlock[]) => {
    setIsSaving(true);

    try {
      // Check if a sequence already exists, update it; otherwise create new
      const existingSequence = project.sequences?.[0];

      if (existingSequence) {
        // Update existing sequence
        const response = await fetch(`/api/projects/${project.id}/sequences/${existingSequence.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: existingSequence.name,
            shots,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save sequence');
        }

        const updatedSequence = await response.json();
        setProject(prev => ({
          ...prev,
          sequences: [updatedSequence],
        }));
      } else {
        // Create new sequence
        const response = await fetch(`/api/projects/${project.id}/sequences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Main Sequence',
            description: `Scene flow for ${project.name}`,
            shots,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save sequence');
        }

        const newSequence = await response.json();
        setProject(prev => ({
          ...prev,
          sequences: [newSequence],
        }));
      }

      showSuccess('Sequence saved successfully!');
    } catch (error) {
      console.error('Error saving sequence:', error);
      showError(error instanceof Error ? error.message : 'Failed to save sequence');
    } finally {
      setIsSaving(false);
    }
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

      <Header />

      <main className="page">
        <div className="container">
          <Breadcrumb
            items={[
              { label: 'Projects', href: '/' },
              { label: project.name, href: `/project/${project.id}` },
              { label: 'Scene Flow' },
            ]}
          />

          <div className={styles.header}>
            <div className={styles.headerInfo}>
              <h1 className={styles.title}>{project.name}</h1>
              <p className={styles.meta}>
                {project.scenes.length} {project.scenes.length === 1 ? 'scene' : 'scenes'} available
              </p>
            </div>
          </div>

          <ProjectNavigation projectId={project.id} activeTab="sequence" />

          {project.scenes.length > 0 ? (
            <div className={styles.content}>
              <SceneSequencer
                scenes={project.scenes}
                initialOrder={project.sequences?.[0]?.shots}
                onSave={handleSaveSequence}
                onExport={handleExportScript}
                isSaving={isSaving}
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

  try {
    const project = await getProjectByIdAsync(projectId);

    if (!project) {
      return { notFound: true };
    }

    // Verify user owns this project (strict check - projects must have userId)
    if (project.userId !== session.user.id) {
      return { notFound: true };
    }

    return {
      props: { project },
    };
  } catch (error) {
    console.error('Failed to load project:', error);
    return { notFound: true };
  }
};

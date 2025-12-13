import { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Header from '@/components/Header';
import ImageWithFallback from '@/components/ImageWithFallback';
import { Project } from '@/types';
import { query, dbGetProjectById, isPostgresAvailable } from '@/utils/db';
import styles from '@/styles/Shared.module.css';

interface SharedPageProps {
  project: Project | null;
  error?: string;
}

export default function SharedProjectPage({ project, error }: SharedPageProps) {
  if (error || !project) {
    return (
      <>
        <Head>
          <title>Project Not Found | HALCYON-Cinema</title>
        </Head>
        <Header />
        <main className="page">
          <div className="container">
            <div className={styles.errorState}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <h1>Project Not Found</h1>
              <p>{error || 'This shared project does not exist or has been removed.'}</p>
              <Link href="/" className="btn btn-primary">
                Go to Home
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{project.name} | Shared Project | HALCYON-Cinema</title>
        <meta name="description" content={project.description || `View ${project.name} on HALCYON-Cinema`} />
        <meta property="og:title" content={project.name} />
        <meta property="og:description" content={project.description || 'Shared HALCYON-Cinema project'} />
        {project.scenes[0]?.imageUrl && (
          <meta property="og:image" content={project.scenes[0].imageUrl} />
        )}
      </Head>

      <Header />

      <main className="page">
        <div className="container">
          <div className={styles.header}>
            <div className={styles.badge}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              Shared Project
            </div>
            <h1 className={styles.title}>{project.name}</h1>
            {project.description && (
              <p className={styles.description}>{project.description}</p>
            )}
            <div className={styles.meta}>
              <span>{project.scenes.length} scenes</span>
              {project.characters && project.characters.length > 0 && (
                <span>{project.characters.length} characters</span>
              )}
            </div>
          </div>

          {project.scenes.length === 0 ? (
            <div className={styles.emptyState}>
              <p>This project has no scenes yet.</p>
            </div>
          ) : (
            <div className={styles.scenes}>
              {project.scenes.map((scene, index) => (
                <div key={scene.id} className={styles.sceneCard}>
                  <div className={styles.sceneImage}>
                    {scene.metadata?.mediaType === 'video' && scene.imageUrl ? (
                      <video
                        src={scene.imageUrl}
                        className={styles.video}
                        controls
                        playsInline
                      />
                    ) : (
                      <ImageWithFallback
                        src={scene.imageUrl}
                        alt={`Scene ${index + 1}`}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        fallbackType="scene"
                      />
                    )}
                    <span className={styles.sceneNumber}>Scene {index + 1}</span>
                  </div>
                  <div className={styles.sceneInfo}>
                    <p className={styles.prompt}>{scene.prompt}</p>
                    {scene.metadata && (
                      <div className={styles.tags}>
                        {scene.metadata.style && (
                          <span className={styles.tag}>{scene.metadata.style}</span>
                        )}
                        {scene.metadata.shotType && (
                          <span className={styles.tag}>{scene.metadata.shotType}</span>
                        )}
                        {scene.metadata.mood && (
                          <span className={styles.tag}>{scene.metadata.mood}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Characters Section */}
          {project.characters && project.characters.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Characters</h2>
              <div className={styles.characters}>
                {project.characters.map((character) => (
                  <div key={character.id} className={styles.characterCard}>
                    {character.imageUrl && (
                      <div className={styles.characterImage}>
                        <ImageWithFallback
                          src={character.imageUrl}
                          alt={character.name}
                          fill
                          sizes="150px"
                          fallbackType="character"
                        />
                      </div>
                    )}
                    <div className={styles.characterInfo}>
                      <h3>{character.name}</h3>
                      <p>{character.description}</p>
                      {character.traits.length > 0 && (
                        <div className={styles.traits}>
                          {character.traits.slice(0, 3).map((trait, i) => (
                            <span key={i} className={styles.trait}>{trait}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className={styles.cta}>
            <h3>Create your own cinematic stories</h3>
            <p>Sign up for HALCYON-Cinema and bring your creative visions to life with AI.</p>
            <Link href="/auth/signup" className="btn btn-primary">
              Get Started Free
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<SharedPageProps> = async (context) => {
  const { shareId } = context.params || {};

  if (!shareId || typeof shareId !== 'string') {
    return {
      props: { project: null, error: 'Invalid share link' },
    };
  }

  if (!isPostgresAvailable()) {
    return {
      props: { project: null, error: 'Database not available' },
    };
  }

  try {
    // Get share record
    const shareResult = await query(
      `SELECT project_id FROM project_shares
       WHERE id = $1 AND is_public = true
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [shareId]
    );

    if (shareResult.rows.length === 0) {
      return {
        props: { project: null, error: 'Share link not found or expired' },
      };
    }

    const projectId = (shareResult.rows[0] as { project_id: string }).project_id;

    // Increment view count
    await query(
      'UPDATE project_shares SET view_count = view_count + 1 WHERE id = $1',
      [shareId]
    );

    // Get project
    const project = await dbGetProjectById(projectId);

    if (!project) {
      return {
        props: { project: null, error: 'Project not found' },
      };
    }

    return {
      props: {
        project: JSON.parse(JSON.stringify(project)),
      },
    };
  } catch (error) {
    console.error('[shared] Error:', error);
    return {
      props: { project: null, error: 'Failed to load project' },
    };
  }
};

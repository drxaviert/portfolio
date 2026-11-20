import type { Metadata } from "next";
import { Media } from "@/components/media/media";
import { listPosts } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Play",
};

const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * `/play`: the media feed before its design pass. A plain static list, one
 * entry per file in `content/posts/`, newest first; the media is drawn by the
 * same `<Media>` the studies use, so a bad manifest id fails the build.
 *
 * No per-post route and no body yet: the entries are title, date and media.
 */
export default function PlayPage() {
  const posts = listPosts();

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 pt-16 pb-48 md:px-8">
      <header className="mb-12">
        <h1 className="text-title-sm font-medium">Play</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Sketches, tests and loops.
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No posts yet.</p>
      ) : (
        <ol className="flex flex-col gap-16">
          {posts.map((post, postIndex) => (
            <li key={post.slug}>
              <article className="flex flex-col gap-5">
                <header className="flex flex-col gap-1">
                  <h2 className="text-2xl font-medium">{post.title}</h2>
                  <time
                    dateTime={post.date}
                    className="text-sm text-on-surface-variant"
                  >
                    {DATE.format(new Date(post.date))}
                  </time>
                </header>

                {post.summary ? (
                  <p className="text-sm leading-relaxed text-on-surface-variant">
                    {post.summary}
                  </p>
                ) : null}

                <div className="flex flex-col gap-6">
                  {post.media.map((id, index) => (
                    <Media
                      key={`${id}-${index}`}
                      id={id}
                      priority={postIndex === 0 && index === 0}
                    />
                  ))}
                </div>
              </article>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

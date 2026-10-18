import { useEffect } from 'react'
import { ARTICLES, GROUP_TITLES, type Article, type ArticleGroup } from './articles'
import { tryItHref } from './links'

const GROUPS = Object.keys(GROUP_TITLES) as ArticleGroup[]

/** learn.html: the whole Learn series on one page, one anchored article each (R-013 §5). */
export function LearnPage() {
  // The browser looks for the #article before React has drawn it: scroll there once it exists.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    if (id) document.getElementById(id)?.scrollIntoView()
  }, [])
  return (
    <div className="learn" id="top">
      <header className="learn-header">
        <p className="learn-home">
          <a href={import.meta.env.BASE_URL}>
            <span className="logo" aria-hidden="true">
              π
            </span>{' '}
            Charts of Pie
          </a>
        </p>
        <h1>Learn</h1>
        <p className="learn-intro">
          Short explanations of every number the app plays, the ways it can read them, and what each
          display shows. Every article has a Try it link that opens the app right there.
        </p>
        <nav aria-label="Contents" className="learn-contents">
          {GROUPS.map((group) => (
            <section key={group}>
              <h2>{GROUP_TITLES[group]}</h2>
              <ul>
                {ARTICLES.filter((a) => a.group === group).map((a) => (
                  <li key={a.id}>
                    <a href={`#${a.id}`}>{a.title}</a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      </header>
      <main>
        {GROUPS.map((group) => (
          <section key={group} aria-labelledby={`group-${group}`}>
            <h2 id={`group-${group}`} className="learn-group">
              {GROUP_TITLES[group]}
            </h2>
            {ARTICLES.filter((a) => a.group === group).map((a) => (
              <ArticleView key={a.id} article={a} />
            ))}
          </section>
        ))}
      </main>
    </div>
  )
}

function ArticleView({ article }: { article: Article }) {
  const headingId = `${article.id}-title`
  return (
    <article id={article.id} className="learn-article" aria-labelledby={headingId}>
      <h3 id={headingId}>{article.title}</h3>
      <p className="learn-summary">{article.summary}</p>
      {article.sections.map((section) => (
        <section key={section.heading}>
          <h4>{section.heading}</h4>
          {section.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
      ))}
      {article.lookFor.length > 0 && (
        <section>
          <h4>Look and listen for</h4>
          <ul>
            {article.lookFor.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}
      <p className="learn-actions">
        <a className="btn btn-primary" href={tryItHref(article.tryIt)}>
          Try it
        </a>
        <a className="learn-top" href="#top">
          Back to contents
        </a>
      </p>
      {article.references.length > 0 && (
        <ul className="learn-references" aria-label="References">
          {article.references.map((r) => (
            <li key={r.url}>
              <a href={r.url} rel="noreferrer" target="_blank">
                {r.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

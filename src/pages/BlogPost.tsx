import { useParams, Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, ArrowRight, UserRound } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { blogPosts } from '@/data/blogPosts';
import { BlogHeader, BlogFooter } from '@/components/blog/BlogShell';
import { BlogCard, BlogMeta } from './Blog';
export default function BlogPost(){
const {slug}=useParams();const post=blogPosts.find(p=>p.slug===slug);if(!post)return <Navigate to="/blog" replace/>;
const related=blogPosts.filter(p=>p.category===post.category&&p.slug!==slug).slice(0,3);
return <div className="wb-page">
      <Helmet>
        <title>{post.title} | Blog WebMarcas</title>
        <meta name="description" content={post.description} />
        <link rel="canonical" href={`https://webmarcas.net/blog/${post.slug}`} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={`https://webmarcas.net/blog/${post.slug}`} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.description} />
        <meta property="article:published_time" content={post.date} />
        <meta property="article:section" content={post.category} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": post.title,
          "description": post.description,
          "datePublished": post.date,
          "articleSection": post.category,
          "author": { "@type": "Organization", "name": "WebMarcas" },
          "publisher": {
            "@type": "Organization",
            "name": "WebMarcas",
            "logo": { "@type": "ImageObject", "url": "https://webmarcas.net/favicon.png" }
          },
          "mainEntityOfPage": `https://webmarcas.net/blog/${post.slug}`
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Início", "item": "https://webmarcas.net/" },
            { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://webmarcas.net/blog" },
            { "@type": "ListItem", "position": 3, "name": post.title, "item": `https://webmarcas.net/blog/${post.slug}` }
          ]
        })}</script>
      </Helmet>
<BlogHeader/><main><article className="wb-article"><Link className="wb-back" to="/blog"><ArrowLeft size={18}/>Voltar ao Blog</Link><span className="wb-category">{post.category}</span><h1>{post.title}</h1><div className="wb-article-meta"><span><UserRound size={16}/>Equipe WebMarcas</span><BlogMeta post={post}/></div><img className="wb-cover" src={post.image} alt={post.title}/><div className="wb-prose"><ReactMarkdown>{post.content}</ReactMarkdown></div><section className="wb-article-cta"><h2>O próximo passo para proteger sua marca.</h2><p>Consulte a viabilidade da sua marca e conheça o processo de registro.</p><Link className="wb-cta" to="/consultar">Consultar minha marca<ArrowRight size={18}/></Link></section>{related.length>0&&<section className="wb-related"><h2>Artigos relacionados</h2><div className="wb-grid">{related.map(p=><BlogCard key={p.slug} post={p}/>)}</div></section>}<Link className="wb-back" to="/blog"><ArrowLeft size={18}/>Voltar ao Blog</Link></article></main><BlogFooter/></div>;
}

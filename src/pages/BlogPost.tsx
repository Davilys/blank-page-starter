import { useParams, Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Clock, Calendar, Share2, Sparkles } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { blogPosts } from "@/data/blogPosts";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";

const BlogPost = () => {
  const { slug } = useParams();
  const post = blogPosts.find((p) => p.slug === slug);
  const currentIndex = blogPosts.findIndex((p) => p.slug === slug);
  const nextPost = currentIndex < blogPosts.length - 1 ? blogPosts[currentIndex + 1] : null;
  const prevPost = currentIndex > 0 ? blogPosts[currentIndex - 1] : null;

  // Related posts (same category, max 3)
  const related = post
    ? blogPosts
        .filter((p) => p.category === post.category && p.slug !== post.slug)
        .slice(0, 3)
    : [];

  if (!post) return <Navigate to="/blog" replace />;

  const handleShare = async () => {
    try {
      await navigator.share({ title: post.title, url: window.location.href });
    } catch {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <>
      <Header />
      <main className="min-h-screen pt-20 md:pt-24">
        {/* Hero Image */}
        <div className="w-full h-72 md:h-[480px] overflow-hidden relative">
          <motion.img
            initial={{ scale: 1.05 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.2 }}
            src={post.image}
            alt={post.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </div>

        {/* Content */}
        <article className="container mx-auto px-4 -mt-28 md:-mt-36 relative z-10 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-card rounded-3xl border border-border/40 shadow-2xl p-7 md:p-12"
          >
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6">
              <Link to="/blog" className="hover:text-primary transition-colors">Blog</Link>
              <span>/</span>
              <span className="text-foreground/70 truncate">{post.title}</span>
            </div>

            {/* Meta */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                {post.category}
              </span>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> {post.readTime}
              </span>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {new Date(post.date).toLocaleDateString("pt-BR")}
              </span>
              <button
                onClick={handleShare}
                className="ml-auto text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-primary/10"
                title="Compartilhar"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>

            <h1 className="font-display text-3xl md:text-5xl font-bold mb-5 text-foreground tracking-tight leading-tight">
              {post.title}
            </h1>
            <p className="text-muted-foreground text-base md:text-lg mb-10 border-b border-border/50 pb-8 leading-relaxed">
              {post.description}
            </p>

            {/* Markdown Content */}
            <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-headings:font-display prose-headings:text-foreground prose-headings:tracking-tight prose-p:text-muted-foreground prose-p:leading-relaxed prose-a:text-primary prose-strong:text-foreground prose-th:text-foreground prose-td:text-muted-foreground prose-li:text-muted-foreground">
              <ReactMarkdown>{post.content}</ReactMarkdown>
            </div>

            {/* CTA */}
            <div className="mt-12 p-8 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/[0.02] border border-primary/15 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold mb-4 uppercase tracking-wider">
                <Sparkles className="w-3 h-3" />
                Consulta Gratuita
              </div>
              <h3 className="font-display text-xl font-bold mb-3 tracking-tight">
                Consulte a viabilidade da sua marca
              </h3>
              <p className="text-muted-foreground text-sm mb-5 max-w-md mx-auto leading-relaxed">
                Receba um laudo técnico gratuito em minutos com nossa inteligência artificial.
              </p>
              <Button variant="default" size="lg" className="rounded-xl shadow-lg shadow-primary/25" asChild>
                <a href="/#consultar">
                  Consultar Grátis <ArrowRight className="w-4 h-4 ml-2" />
                </a>
              </Button>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center mt-10 pt-8 border-t border-border/40 gap-4">
              {prevPost ? (
                <Link
                  to={`/blog/${prevPost.slug}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors group"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  <span className="hidden sm:inline line-clamp-1">{prevPost.title}</span>
                  <span className="sm:hidden">Anterior</span>
                </Link>
              ) : <div />}
              {nextPost ? (
                <Link
                  to={`/blog/${nextPost.slug}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors text-right group"
                >
                  <span className="hidden sm:inline line-clamp-1">{nextPost.title}</span>
                  <span className="sm:hidden">Próximo</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              ) : <div />}
            </div>
          </motion.div>

          {/* Related Posts */}
          {related.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-12 mb-8"
            >
              <h3 className="font-display text-xl font-bold mb-6 text-center">Artigos relacionados</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    to={`/blog/${r.slug}`}
                    className="group block rounded-2xl overflow-hidden border border-border/40 bg-card hover:shadow-lg transition-all duration-500"
                  >
                    <div className="h-32 overflow-hidden">
                      <img
                        src={r.image}
                        alt={r.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-4">
                      <h4 className="font-display font-bold text-xs leading-snug group-hover:text-primary transition-colors line-clamp-2">
                        {r.title}
                      </h4>
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}

          {/* Back to blog */}
          <div className="text-center mt-6 mb-16">
            <Link
              to="/blog"
              className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5 group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Voltar ao Blog
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
};

export default BlogPost;

import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { blogPosts } from "@/data/blogPosts";
import { Button } from "@/components/ui/button";

const BlogPreviewSection = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const posts = blogPosts.slice(0, 6);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.7;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
    setTimeout(updateScrollState, 400);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <section className="section-padding bg-background relative">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Mantenha suas estratégias atualizadas
            </h2>
            <p className="text-muted-foreground text-base md:text-lg">
              Explore nossos artigos educativos, que ensinam como escalar e manter as estratégias do seu negócio sempre atualizadas.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => scroll("left")}
              disabled={!canScrollLeft}
              className="w-12 h-12 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scroll("right")}
              disabled={!canScrollRight}
              className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cards carousel */}
        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="flex gap-8 overflow-x-auto scrollbar-none pb-4 -mx-4 px-4 snap-x snap-mandatory"
        >
          {posts.map((post) => (
            <article
              key={post.slug}
              className="flex-shrink-0 w-[85vw] sm:w-[420px] md:w-[500px] lg:w-[540px] snap-start flex flex-col sm:flex-row gap-5 group"
            >
              {/* Image */}
              <Link to={`/blog/${post.slug}`} className="sm:w-[220px] md:w-[250px] flex-shrink-0">
                <div className="overflow-hidden rounded-2xl aspect-[4/3]">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
              </Link>

              {/* Content */}
              <div className="flex flex-col justify-center gap-2 min-w-0">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">
                  {formatDate(post.date)}
                </span>
                <Link to={`/blog/${post.slug}`}>
                  <h3 className="font-display text-lg md:text-xl font-bold text-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                    {post.title}
                  </h3>
                </Link>
                <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                  {post.description}
                </p>
                <Link
                  to={`/blog/${post.slug}`}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline mt-1"
                >
                  Ver artigo <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </article>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <Button asChild variant="hero" size="lg">
            <Link to="/blog">EXPLORAR BLOG</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default BlogPreviewSection;

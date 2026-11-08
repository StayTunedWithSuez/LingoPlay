import React, { useState } from 'react';
import {
  ArrowLeft,
  GraduationCap,
  Code2,
  Cpu,
  FlaskConical,
  BarChart3,
  Mail,
  MessageCircle,
  ExternalLink,
  Subtitles,
  Sparkles,
  Rewind,
  SlidersHorizontal,
  Eye,
  Film,
  Volume2,
  Layout,
  User,
} from 'lucide-react';
import { LingoPlayLogo } from './LingoPlayLogo';

interface AboutPageProps {
  onBackToPlayer: () => void;
}

const DEVELOPER_PHOTO_URL =
  'https://scontent.fcgp3-1.fna.fbcdn.net/v/t39.30808-6/775127630_3397322160427352_6341854841851778821_n.jpg?stp=dst-jpg_tt6&cstp=mx1319x1340&ctp=s1319x1340&_nc_cat=107&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=NOwiuKCO8d4Q7kNvwEkcy5n&_nc_oc=Ado2FKptZ8yn1r_Ber9c4a7jOwOMRWNf-XjOHA9Cf0FYo3WR079GTmcF2Y1gwEdBtpI&_nc_zt=23&_nc_ht=scontent.fcgp3-1.fna&_nc_gid=N5jkMe2ZED60kYMt5qX-vg&_nc_ss=7b289&oh=00_AQT967HX93_YPskFWBWcGhcntABoWUj7A_ofKCOW_6UimA&oe=6AF636EF';

const TECHNICAL_INTERESTS = [
  {
    title: 'JavaScript & Python Programming',
    icon: Code2,
  },
  {
    title: 'Machine Learning & Artificial Intelligence',
    icon: Cpu,
  },
  {
    title: 'Computational Modeling & Simulation',
    icon: BarChart3,
  },
  {
    title: 'Engineering Research & Data Analysis',
    icon: FlaskConical,
  },
];

const RESEARCH_AREAS = [
  'Thermal Engineering',
  'Fire-Induced Thermal Degradation',
  'Multilayer Insulation Systems',
  'Numerical Simulation',
  'Machine Learning Applications in Engineering',
];

const KEY_FEATURES = [
  {
    title: 'Interactive Subtitles',
    description:
      'Load external SRT/VTT subtitle files and interact with subtitles directly. Select individual words, phrases, or complete sentences while watching.',
    icon: Subtitles,
  },
  {
    title: 'Gemini AI-Powered Translation',
    description:
      'Translate selected English subtitle text into natural Bengali using Google Gemini. Understand words, idioms, and conversational expressions in context without leaving the video player.',
    icon: Sparkles,
  },
  {
    title: 'Precise Playback Control',
    description:
      'Move backward or forward by five seconds using keyboard shortcuts or on-screen controls. Easily repeat dialogue to improve listening comprehension.',
    icon: Rewind,
  },
  {
    title: 'Subtitle Customization',
    description:
      'Adjust subtitle synchronization, font size, vertical position, visibility, and appearance for a comfortable viewing experience.',
    icon: SlidersHorizontal,
  },
  {
    title: 'Concentration Mode',
    description:
      'Enable a distraction-free viewing experience that hides unnecessary interface elements while keeping essential playback controls and interactive subtitles available.',
    icon: Eye,
  },
  {
    title: 'Flexible Video Playback',
    description:
      'Play compatible video files directly from local storage or stream supported media URLs through the browser.',
    icon: Film,
  },
  {
    title: 'Audio and Playback Options',
    description:
      'Adjust playback speed and volume, use supported audio-track switching, and access external audio support when needed.',
    icon: Volume2,
  },
  {
    title: 'Clean and Minimal Interface',
    description:
      'Enjoy a modern, YouTube-inspired dark interface designed to keep attention on video content and language learning.',
    icon: Layout,
  },
];

export const AboutPage: React.FC<AboutPageProps> = ({ onBackToPlayer }) => {
  const [photoError, setPhotoError] = useState(false);

  return (
    <div
      data-testid="about-page-view"
      className="min-h-screen w-full bg-[#0F0F0F] text-[#F1F1F1] select-text"
    >
      {/* Top Navigation Header */}
      <header
        data-testid="about-page-header"
        className="sticky top-0 z-30 w-full bg-[#0F0F0F]/95 backdrop-blur-md border-b border-[#383838]/80"
      >
        <div className="mx-auto max-w-[1040px] px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <LingoPlayLogo onClick={onBackToPlayer} testId="about-header-logo" />

          <button
            type="button"
            data-testid="back-to-player-btn"
            onClick={onBackToPlayer}
            className="inline-flex items-center gap-2 rounded-lg bg-[#212121] hover:bg-[#303030] border border-[#383838] px-3.5 py-1.5 text-xs sm:text-sm font-medium text-[#F1F1F1] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#FF0033]" />
            <span>Back to Player</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <div className="mx-auto max-w-[1040px] px-4 sm:px-6 py-10 sm:py-14 space-y-14 sm:space-y-16">
        {/* =====================================================================
            FIRST MAIN SECTION: ABOUT THE DEVELOPER
           ===================================================================== */}
        <section
          aria-labelledby="about-developer-heading"
          data-testid="about-developer-section"
          className="space-y-10"
        >
          <div className="border-b border-[#383838] pb-4">
            <h1
              id="about-developer-heading"
              className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F1F1F1]"
            >
              About the Developer
            </h1>
          </div>

          {/* Developer Profile Card (Photo on Left on Desktop, Biography on Right) */}
          <div className="rounded-xl bg-[#212121] border border-[#383838] p-6 sm:p-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-7 lg:gap-9">
              {/* Developer Portrait Frame */}
              <div className="shrink-0">
                {!photoError ? (
                  <div className="w-44 h-44 sm:w-52 sm:h-52 rounded-2xl overflow-hidden border border-[#383838] bg-[#181818] shadow-lg">
                    <img
                      src={DEVELOPER_PHOTO_URL}
                      alt="Md. Suez — Mechanical Engineering Graduate and Researcher"
                      referrerPolicy="no-referrer"
                      onError={() => setPhotoError(true)}
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                ) : (
                  <div
                    data-testid="developer-photo-fallback"
                    aria-label="Md. Suez profile portrait placeholder"
                    className="w-44 h-44 sm:w-52 sm:h-52 rounded-2xl border border-[#383838] bg-[#181818] flex flex-col items-center justify-center gap-2 text-[#AAAAAA] shadow-lg select-none"
                  >
                    <User className="w-12 h-12 text-[#FF0033]/80 stroke-[1.5]" />
                    <span className="text-base font-semibold tracking-wide text-[#F1F1F1]">
                      Md. Suez
                    </span>
                  </div>
                )}
              </div>

              {/* Developer Name, Title & Biography */}
              <div className="flex-1 min-w-0 space-y-4 text-center md:text-left">
                <div className="space-y-1">
                  <h2 className="text-2xl sm:text-[26px] font-bold tracking-tight text-[#F1F1F1]">
                    Md. Suez
                  </h2>
                  <p className="text-sm sm:text-base font-medium text-[#FF0033]">
                    Mechanical Engineering Graduate | Researcher
                  </p>
                </div>

                <div className="space-y-3.5 text-sm sm:text-[15px] leading-relaxed text-[#F1F1F1]/90">
                  <p>
                    Md. Suez is a Mechanical Engineering graduate from Chittagong University of
                    Engineering &amp; Technology (CUET), where he completed his B.Sc. in
                    Mechanical Engineering with a CGPA of 3.80/4.00, securing 7th position among
                    176 students (Top 4% of his batch).
                  </p>
                  <p>
                    He is currently pursuing an M.Sc. in Mechanical Engineering at Bangladesh
                    University of Engineering and Technology (BUET). His academic and
                    professional interests include computational modeling, thermal engineering,
                    artificial intelligence, machine learning, and software development.
                  </p>
                  <p>
                    Beyond his engineering background, he has a strong interest in developing
                    practical software solutions and educational technology. He works with modern
                    web technologies and programming tools to build user-friendly, efficient, and
                    accessible applications.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Education Section */}
          <div className="space-y-4" data-testid="education-section">
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-[#F1F1F1] flex items-center gap-2.5">
              <GraduationCap className="w-5 h-5 text-[#FF0033] shrink-0" />
              <span>Education</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* BUET */}
              <div className="rounded-xl bg-[#212121] border border-[#383838] p-5 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <h3 className="text-base font-semibold text-[#F1F1F1] leading-snug">
                    Bangladesh University of Engineering and Technology (BUET)
                  </h3>
                  <p className="text-sm font-medium text-[#FF0033]">
                    M.Sc. in Mechanical Engineering
                  </p>
                </div>
                <div className="pt-2 border-t border-[#383838]/70 text-xs sm:text-sm text-[#AAAAAA]">
                  <span className="text-[#F1F1F1] font-medium">Status:</span> Ongoing
                </div>
              </div>

              {/* CUET */}
              <div className="rounded-xl bg-[#212121] border border-[#383838] p-5 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <h3 className="text-base font-semibold text-[#F1F1F1] leading-snug">
                    Chittagong University of Engineering &amp; Technology (CUET)
                  </h3>
                  <p className="text-sm font-medium text-[#FF0033]">
                    B.Sc. in Mechanical Engineering
                  </p>
                </div>
                <div className="pt-2 border-t border-[#383838]/70 space-y-1 text-xs sm:text-sm text-[#AAAAAA] tabular-nums">
                  <div>
                    <span className="text-[#F1F1F1] font-medium">CGPA:</span> 3.80/4.00
                  </div>
                  <div>
                    <span className="text-[#F1F1F1] font-medium">Academic Rank:</span> 7th out of
                    176 students
                  </div>
                  <div>
                    <span className="text-[#F1F1F1] font-medium">Achievement:</span> Top 4% of the
                    graduating batch
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Technical Interests & Skills */}
          <div className="space-y-4" data-testid="technical-skills-section">
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-[#F1F1F1]">
              Technical Interests &amp; Skills
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {TECHNICAL_INTERESTS.map((item) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-xl bg-[#212121] border border-[#383838] px-4 py-3.5 flex items-center gap-3.5"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#181818] border border-[#383838] flex items-center justify-center shrink-0">
                      <IconComponent className="w-4 h-4 text-[#FF0033]" />
                    </div>
                    <span className="text-sm font-medium text-[#F1F1F1]">{item.title}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Research & Academic Interests */}
          <div className="space-y-4" data-testid="research-interests-section">
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-[#F1F1F1]">
              Research &amp; Academic Interests
            </h2>

            <div className="rounded-xl bg-[#212121] border border-[#383838] p-5 sm:p-6 space-y-4">
              <p className="text-sm sm:text-[15px] leading-relaxed text-[#F1F1F1]/90">
                His research interests focus on thermal engineering, fire-induced thermal
                degradation, multilayer insulation systems, numerical simulation, and machine
                learning applications in engineering.
              </p>

              <div className="pt-2 border-t border-[#383838]/80 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs sm:text-sm text-[#AAAAAA]">
                {RESEARCH_AREAS.map((area, index) => (
                  <React.Fragment key={area}>
                    <span className="text-[#F1F1F1] font-medium">{area}</span>
                    {index < RESEARCH_AREAS.length - 1 && (
                      <span aria-hidden="true" className="text-[#FF0033]">
                        ·
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* Contact & Profiles */}
          <div className="space-y-4" data-testid="contact-profiles-section">
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-[#F1F1F1]">
              Contact &amp; Profiles
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Email */}
              <a
                href="mailto:swez.sohan@gmail.com"
                data-testid="contact-email-link"
                className="group rounded-xl bg-[#212121] hover:bg-[#2a2a2a] border border-[#383838] px-4 py-3.5 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-[#181818] border border-[#383838] flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-[#FF0033]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-[#AAAAAA]">Email</div>
                    <div className="text-sm font-medium text-[#F1F1F1] truncate">
                      swez.sohan@gmail.com
                    </div>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-[#AAAAAA] group-hover:text-[#F1F1F1] shrink-0 transition-colors" />
              </a>

              {/* WhatsApp */}
              <a
                href="https://wa.me/8801991642680"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="contact-whatsapp-link"
                className="group rounded-xl bg-[#212121] hover:bg-[#2a2a2a] border border-[#383838] px-4 py-3.5 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-[#181818] border border-[#383838] flex items-center justify-center shrink-0">
                    <MessageCircle className="w-4 h-4 text-[#FF0033]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-[#AAAAAA]">WhatsApp</div>
                    <div className="text-sm font-medium text-[#F1F1F1] tabular-nums truncate">
                      01991642680
                    </div>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-[#AAAAAA] group-hover:text-[#F1F1F1] shrink-0 transition-colors" />
              </a>

              {/* Facebook */}
              <a
                href="https://facebook.com/swez.sohan/"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="contact-facebook-link"
                className="group rounded-xl bg-[#212121] hover:bg-[#2a2a2a] border border-[#383838] px-4 py-3.5 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-[#181818] border border-[#383838] flex items-center justify-center shrink-0">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-4 h-4 text-[#FF0033]"
                      aria-hidden="true"
                    >
                      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-[#AAAAAA]">Facebook</div>
                    <div className="text-sm font-medium text-[#F1F1F1] truncate">
                      facebook.com/swez.sohan/
                    </div>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-[#AAAAAA] group-hover:text-[#F1F1F1] shrink-0 transition-colors" />
              </a>

              {/* LinkedIn */}
              <a
                href="https://linkedin.com/in/md-suez"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="contact-linkedin-link"
                className="group rounded-xl bg-[#212121] hover:bg-[#2a2a2a] border border-[#383838] px-4 py-3.5 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-[#181818] border border-[#383838] flex items-center justify-center shrink-0">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-4 h-4 text-[#FF0033]"
                      aria-hidden="true"
                    >
                      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                      <rect width="4" height="12" x="2" y="9" />
                      <circle cx="4" cy="4" r="2" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-[#AAAAAA]">LinkedIn</div>
                    <div className="text-sm font-medium text-[#F1F1F1] truncate">
                      linkedin.com/in/md-suez
                    </div>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-[#AAAAAA] group-hover:text-[#F1F1F1] shrink-0 transition-colors" />
              </a>
            </div>
          </div>
        </section>

        {/* =====================================================================
            SECOND MAIN SECTION: ABOUT LINGO PLAY
           ===================================================================== */}
        <section
          aria-labelledby="about-lingo-play-heading"
          data-testid="about-lingo-play-section"
          className="space-y-10 pt-2"
        >
          <div className="border-b border-[#383838] pb-4">
            <h1
              id="about-lingo-play-heading"
              className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F1F1F1]"
            >
              About Lingo Play
            </h1>
          </div>

          {/* Application Introduction & Why Lingo Play Was Created */}
          <div className="rounded-xl bg-[#212121] border border-[#383838] p-6 sm:p-8 space-y-8">
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F1F1F1]">
                  Lingo Play
                </h2>
                <p className="text-sm sm:text-base font-semibold text-[#FF0033]">
                  Watch. Understand. Learn.
                </p>
              </div>

              <div className="space-y-3.5 text-sm sm:text-[15px] leading-relaxed text-[#F1F1F1]/90">
                <p>
                  Lingo Play is a modern, browser-based video player designed to make learning
                  English through movies, television shows, and other video content easier, more
                  interactive, and more enjoyable.
                </p>
                <p>
                  Unlike traditional video players that focus primarily on media playback, Lingo
                  Play combines essential playback controls with language-learning features that
                  help users understand spoken English naturally.
                </p>
                <p>
                  The application allows users to watch videos, read interactive subtitles, select
                  unfamiliar English words or expressions, and access context-aware Bengali
                  translations powered by Google&apos;s Gemini AI.
                </p>
                <p>
                  The goal is to make English learning a seamless part of the viewing experience
                  without requiring users to constantly switch between a video player, dictionary,
                  and translation website.
                </p>
                <p>
                  Lingo Play emphasizes simplicity, accessibility, and concentration. Its minimal
                  interface provides the essential tools needed for comfortable viewing while
                  keeping unnecessary distractions out of the way.
                </p>
                <p>
                  Whether someone is practicing listening comprehension, understanding unfamiliar
                  vocabulary, exploring conversational expressions, or learning English through
                  entertainment, Lingo Play aims to provide a convenient and engaging learning
                  environment.
                </p>
              </div>
            </div>

            <div className="h-px bg-[#383838]" />

            <div className="space-y-3.5">
              <h3 className="text-lg sm:text-xl font-semibold tracking-tight text-[#F1F1F1]">
                Why Lingo Play Was Created
              </h3>

              <div className="space-y-3.5 text-sm sm:text-[15px] leading-relaxed text-[#F1F1F1]/90">
                <p>
                  English movies and television shows offer valuable opportunities to learn
                  natural vocabulary, pronunciation, expressions, and conversational language.
                </p>
                <p>
                  However, understanding unfamiliar dialogue often requires repeatedly pausing a
                  video, searching for word meanings, switching between browser tabs, and manually
                  adjusting subtitles.
                </p>
                <p>Lingo Play was created to make this process simpler.</p>
                <p>
                  By combining video playback, selectable subtitles, precise seeking controls, and
                  AI-powered translation within one interface, the application makes it easier to
                  focus on understanding language rather than managing multiple tools.
                </p>
                <p>The core philosophy of Lingo Play is simple:</p>
                <p className="font-semibold text-[#F1F1F1]">
                  Learning should happen naturally while watching, with the right tools available
                  whenever they are needed.
                </p>
              </div>
            </div>
          </div>

          {/* Key Features */}
          <div className="space-y-4" data-testid="key-features-section">
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-[#F1F1F1]">
              Key Features
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {KEY_FEATURES.map((feature) => {
                const FeatureIcon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="rounded-xl bg-[#212121] border border-[#383838] p-5 space-y-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#181818] border border-[#383838] flex items-center justify-center shrink-0">
                        <FeatureIcon className="w-4 h-4 text-[#FF0033]" />
                      </div>
                      <h3 className="text-sm sm:text-base font-semibold text-[#F1F1F1]">
                        {feature.title}
                      </h3>
                    </div>
                    <p className="text-xs sm:text-sm leading-relaxed text-[#AAAAAA]">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Design Philosophy */}
          <div className="space-y-4" data-testid="design-philosophy-section">
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-[#F1F1F1]">
              Designed for Focused Learning
            </h2>

            <div className="rounded-xl bg-[#212121] border border-[#383838] p-6 space-y-3 text-sm sm:text-[15px] leading-relaxed text-[#F1F1F1]/90">
              <p>
                Lingo Play is built around the belief that effective language learning should be
                simple, accessible, and enjoyable.
              </p>
              <p>
                By combining familiar video playback controls with interactive subtitles and
                context-aware translation, Lingo Play helps learners spend less time managing
                tools and more time understanding the language they hear.
              </p>
              <p>
                The application prioritizes a clean interface, practical functionality, and an
                uninterrupted viewing experience.
              </p>
            </div>
          </div>
        </section>

        {/* =====================================================================
            FOOTER
           ===================================================================== */}
        <footer
          data-testid="about-page-footer"
          className="pt-8 border-t border-[#383838] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm text-[#AAAAAA]"
        >
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-center sm:text-left">
            <span className="font-semibold text-[#F1F1F1]">Lingo Play</span>
            <span aria-hidden="true" className="hidden sm:inline text-[#383838]">
              ·
            </span>
            <span>Developed by Md. Suez</span>
            <span aria-hidden="true" className="hidden sm:inline text-[#383838]">
              ·
            </span>
            <span className="text-[#AAAAAA]">Watch. Understand. Learn.</span>
          </div>

          <button
            type="button"
            data-testid="footer-back-to-player-btn"
            onClick={onBackToPlayer}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[#F1F1F1] hover:text-[#FF0033] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#FF0033]" />
            <span>Back to Video Player</span>
          </button>
        </footer>
      </div>
    </div>
  );
};

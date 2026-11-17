import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, BadgeCheck, Copy, Download, ExternalLink, GraduationCap, Search } from 'lucide-react';
import { errorMessage, useCertificatesQuery, useLazyDownloadCertificateQuery } from '../../api';
import { Badge, Button, EmptyState, Skeleton } from '../../components/ui';
import { fullDate } from '../../lib/format';
import { useToast } from '../../components/Toast';

export default function Certificates() {
  const { data: certificates = [], isLoading } = useCertificatesQuery();
  const [download, { isFetching }] = useLazyDownloadCertificateQuery();
  const [busySerial, setBusySerial] = useState<string | null>(null);
  const toast = useToast();

  const handleDownload = async (serial: string) => {
    setBusySerial(serial);
    try {
      const blob = await download(serial).unwrap();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `lumen-${serial}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Certificate downloaded');
    } catch (error) {
      toast.error('Download failed', errorMessage(error, 'The PDF could not be loaded'));
    } finally {
      setBusySerial(null);
    }
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-caps mb-2">Your credentials</p>
          <h1 className="text-[clamp(1.8rem,3.4vw,2.5rem)] leading-none text-ink">Certificates.</h1>
          <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-muted">
            Each certificate carries a unique serial and a QR code that resolves to a public verification record.
            Download the PDF or copy a verification link to share.
          </p>
        </div>
        <Link to="/verify">
          <Button variant="outline" icon={<Search size={14} />}>Verify a serial</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      ) : certificates.length === 0 ? (
        <EmptyState
          icon={<Award size={22} />}
          title="No certificates yet"
          description="Finish every lesson in a course and its assessment, and your certificate will be issued automatically."
          action={<Link to="/app"><Button variant="primary" size="sm">Go to my courses</Button></Link>}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {certificates.map((certificate) => (
            <div key={certificate.serial} className="group overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_20px_60px_-40px_rgba(0,0,0,0.9)]">
              {/* certificate preview */}
              <div className="relative overflow-hidden bg-[#F7F3EA] p-5 text-[#14161B]">
                <div className="absolute inset-3 border border-[#14161B]/55" />
                <div className="absolute inset-[17px] border border-[#E2542A]/65" />
                <div className="relative px-2 py-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#E2542A] font-display text-[13px]">L</span>
                      <span className="font-mono text-[6.5px] uppercase tracking-[0.2em]">Lumen Academy</span>
                    </div>
                    <span className="flex items-center gap-1 rounded-full border border-[#3E7F70]/50 px-1.5 py-0.5 font-mono text-[5.5px] uppercase tracking-[0.1em] text-[#3E7F70]">
                      <BadgeCheck size={8} /> Verified
                    </span>
                  </div>
                  <p className="mt-5 font-mono text-[5.5px] uppercase tracking-[0.2em] text-[#E2542A]">Certificate of completion</p>
                  <p className="mt-2 font-display text-[10px] italic text-[#4B4F57]">Presented to</p>
                  <p className="mt-1 font-display text-[19px] leading-none">{certificate.studentName}</p>
                  <div className="my-3 h-px w-full bg-[#14161B]/20" />
                  <p className="text-[6.5px] uppercase tracking-[0.1em] text-[#5D626C]">for completing</p>
                  <p className="mt-0.5 line-clamp-1 text-[11px] font-semibold leading-tight">{certificate.courseTitle}</p>
                  <div className="mt-5 flex items-end justify-between">
                    <div>
                      <p className="font-display text-[9px] italic">{certificate.instructorName}</p>
                      <div className="mt-0.5 h-px w-20 bg-[#14161B]" />
                    </div>
                    <span className="font-mono text-[6px] text-[#5D626C]">{certificate.serial}</span>
                  </div>
                </div>
              </div>

              {/* record */}
              <div className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-medium text-ink">{certificate.courseTitle}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-faint">Issued {fullDate(certificate.issuedAt)}</p>
                  </div>
                  <Badge tone="verdigris" dot>Valid</Badge>
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-raised px-2.5 py-2">
                  <GraduationCap size={13} className="shrink-0 text-faint" />
                  <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-muted">{certificate.serial}</span>
                  <button
                    onClick={() => {
                      void navigator.clipboard?.writeText(certificate.serial);
                      toast.success('Serial copied');
                    }}
                    className="text-faint hover:text-ink"
                    aria-label="Copy serial"
                  >
                    <Copy size={12} />
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Download size={13} />}
                    loading={busySerial === certificate.serial}
                    disabled={isFetching && busySerial !== certificate.serial}
                    onClick={() => void handleDownload(certificate.serial)}
                  >
                    Download PDF
                  </Button>
                  <Link to={certificate.verifyUrl}>
                    <Button variant="outline" size="sm" icon={<ExternalLink size={13} />}>Verify record</Button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-start gap-3 rounded-xl border border-line bg-[color-mix(in_oklab,var(--c-surface)_55%,var(--c-canvas))] p-4">
        <BadgeCheck size={18} className="mt-0.5 shrink-0 text-verdigris" />
        <p className="text-[12px] leading-relaxed text-muted">
          Certificates are issued only after all lessons and the passing assessment are complete. Third parties can
          confirm any serial against the public registry without signing in.
        </p>
      </div>
    </div>
  );
}

import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import QRCodeLib from 'qrcode';
import { env } from '../config/env';
import { Certificate } from '../models/learning';
import { Course } from '../models/course';
import { User } from '../models/user';
import { certificateFile, ensureMediaDirs, newSerial, publishCertificate } from '../lib/media';
import { logger } from '../lib/logger';

const INK = '#14161B';
const PAPER = '#F7F3EA';
const EMBER = '#E2542A';
const VERDIGRIS = '#3E7F70';

function formatLongDate(date: Date) {
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

function drawSeal(doc: PDFKit.PDFDocument, cx: number, cy: number, radius: number) {
  doc.save();
  doc.lineWidth(1).strokeColor(EMBER).circle(cx, cy, radius).stroke();
  doc.lineWidth(0.5).strokeColor(INK).circle(cx, cy, radius - 6).stroke();

  const points = 24;
  doc.strokeColor(EMBER).lineWidth(0.7);
  for (let i = 0; i < points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    const inner = radius - 3;
    const outer = radius + (i % 2 === 0 ? 7 : 4);
    doc
      .moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner)
      .lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer)
      .stroke();
  }

  doc.fillColor(INK).font('Times-Bold').fontSize(30).text('L', cx - radius, cy - 14, {
    width: radius * 2,
    align: 'center',
  });
  doc
    .fillColor(EMBER)
    .font('Helvetica')
    .fontSize(5.5)
    .text('LUMEN ACADEMY', cx - radius, cy + 20, { width: radius * 2, align: 'center', characterSpacing: 1.4 });
  doc.restore();
}

export async function renderCertificatePdf(input: {
  serial: string;
  studentName: string;
  courseTitle: string;
  instructorName: string;
  issuedAt: Date;
  verifyUrl: string;
}) {
  ensureMediaDirs();
  const target = certificateFile(input.serial);
  fs.mkdirSync(path.dirname(target), { recursive: true });

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
  const stream = fs.createWriteStream(target);
  doc.pipe(stream);

  const width = doc.page.width;
  const height = doc.page.height;

  doc.rect(0, 0, width, height).fill(PAPER);

  // Border system
  doc.lineWidth(2).strokeColor(INK).rect(24, 24, width - 48, height - 48).stroke();
  doc.lineWidth(0.6).strokeColor(EMBER).rect(32, 32, width - 64, height - 64).stroke();

  // Faint registration marks + grain lines
  doc.save().strokeColor('#DCD5C6').lineWidth(0.5);
  for (let x = 60; x < width - 60; x += 28) {
    doc.moveTo(x, 40).lineTo(x, 46).stroke();
    doc.moveTo(x, height - 46).lineTo(x, height - 40).stroke();
  }
  doc.restore();

  doc
    .fillColor(INK)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('LUMEN ACADEMY', 72, 70, { characterSpacing: 3.4 });
  doc
    .fillColor(VERDIGRIS)
    .font('Helvetica')
    .fontSize(7.5)
    .text('CERTIFICATE REGISTRY · VERIFIED ISSUE', 72, 86, { characterSpacing: 1.4 });

  doc
    .fillColor(EMBER)
    .font('Helvetica-Bold')
    .fontSize(8)
    .text('CERTIFICATE OF COMPLETION', 72, 138, { characterSpacing: 2.6 });

  doc.fillColor(INK).font('Times-Roman').fontSize(44).text('This certifies that', 72, 168);
  doc.fillColor(INK).font('Times-Bold').fontSize(46).text(input.studentName, 72, 214, {
    width: width - 330,
    ellipsis: true,
  });

  doc
    .moveTo(72, 282)
    .lineTo(width - 300, 282)
    .lineWidth(1)
    .strokeColor('#CFC7B6')
    .stroke();

  doc
    .fillColor('#4B4F57')
    .font('Helvetica')
    .fontSize(11)
    .text('has successfully completed the course', 72, 300);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(24).text(input.courseTitle, 72, 322, {
    width: width - 330,
  });

  doc
    .fillColor('#4B4F57')
    .font('Helvetica')
    .fontSize(9.5)
    .text(
      'Issued upon completion of every lesson, graded assessment and project checkpoint in the curriculum.',
      72,
      372,
      { width: width - 340, lineGap: 2 },
    );

  // Signature block
  doc
    .moveTo(72, height - 150)
    .lineTo(272, height - 150)
    .lineWidth(0.8)
    .strokeColor(INK)
    .stroke();
  doc.fillColor(INK).font('Times-Italic').fontSize(18).text(input.instructorName || 'Lumen Faculty', 72, height - 142);
  doc
    .fillColor('#5D626C')
    .font('Helvetica')
    .fontSize(7.5)
    .text('COURSE INSTRUCTOR', 72, height - 118, { characterSpacing: 1.4 });

  doc
    .moveTo(320, height - 150)
    .lineTo(520, height - 150)
    .lineWidth(0.8)
    .strokeColor(INK)
    .stroke();
  doc.fillColor(INK).font('Helvetica').fontSize(11).text(formatLongDate(input.issuedAt), 320, height - 142);
  doc
    .fillColor('#5D626C')
    .font('Helvetica')
    .fontSize(7.5)
    .text('DATE OF ISSUE', 320, height - 118, { characterSpacing: 1.4 });

  drawSeal(doc, width - 168, 236, 58);

  const qr = await QRCodeLib.toBuffer(input.verifyUrl, {
    margin: 0,
    width: 96,
    color: { dark: INK, light: PAPER },
  });
  doc.image(qr, width - 216, height - 168, { width: 96, height: 96 });
  doc
    .fillColor('#5D626C')
    .font('Helvetica')
    .fontSize(6.5)
    .text('SCAN TO VERIFY', width - 216, height - 66, { width: 96, align: 'center', characterSpacing: 1 });

  doc
    .fillColor(INK)
    .font('Helvetica-Bold')
    .fontSize(8)
    .text(input.serial, width - 380, height - 74, { width: 260, align: 'right', characterSpacing: 0.6 });
  doc
    .fillColor('#7A7F88')
    .font('Helvetica')
    .fontSize(6.5)
    .text(`lumen.academy/verify/${input.serial}`, width - 380, height - 62, { width: 260, align: 'right' });

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  await publishCertificate(input.serial);
  return target;
}

/** Idempotent: one certificate per (student, course). */
export async function issueCertificate(studentId: string, courseId: string) {
  const existing = await Certificate.findOne({ student: studentId, course: courseId }).lean();
  if (existing) return existing;

  const [student, course] = await Promise.all([
    User.findById(studentId).lean(),
    Course.findById(courseId).populate('instructor', 'name').lean(),
  ]);
  if (!student || !course) throw new Error('Cannot issue certificate for a missing student or course');

  const serial = newSerial();
  const issuedAt = new Date();
  const verifyUrl = `${env.clientOrigin.replace(/\/$/, '')}/verify/${serial}`;

  const certificate = await Certificate.create({
    serial,
    student: student._id,
    course: course._id,
    studentName: student.name,
    courseTitle: course.title,
    instructorName: (course as any).instructor?.name ?? 'Lumen Faculty',
    issuedAt,
    verifyHash: serial.toLowerCase(),
    pdfKey: `certificates/${serial}.pdf`,
  });

  try {
    await renderCertificatePdf({
      serial,
      studentName: student.name,
      courseTitle: course.title,
      instructorName: (course as any).instructor?.name ?? 'Lumen Faculty',
      issuedAt,
      verifyUrl,
    });
  } catch (error) {
    logger.error({ error, serial }, 'certificate render failed');
  }

  return certificate;
}

export function certificateToDTO(certificate: any) {
  return {
    serial: certificate.serial,
    studentName: certificate.studentName,
    courseTitle: certificate.courseTitle,
    instructorName: certificate.instructorName,
    issuedAt: new Date(certificate.issuedAt).toISOString(),
    verifyUrl: `/verify/${certificate.serial}`,
  };
}

// keep unused imports referenced for type-safety of the pdfkit typings
export type { PDFDocument };

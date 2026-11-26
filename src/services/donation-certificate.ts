import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

export type DonationCertificateData = {
  donorName: string;
  bloodGroup: string;
  donationDate: Date | string;
  certificateId: string;
};

const projectRoot = path.resolve(__dirname, "..", "..");
const logoPath = path.join(projectRoot, "assets", "eblood-certificate-logo.png");
const devanagariFontPath = path.join(
  projectRoot,
  "assets",
  "fonts",
  "NotoSansDevanagari-Regular.ttf"
);
const signatories = [
  { name: "Humnath Pokharel", title: "CEO, e-Blood", file: "humanth.png" },
  { name: "Surav Bogati", title: "CEO, e-Blood", file: "surav.png" },
];
const burgundy = "#4B1020";
const deepBurgundy = "#310713";
const red = "#7D102C";
const gold = "#C4A15A";
const paleGold = "#E5D19B";
const ivory = "#FFF9E8";
const darkText = "#40121E";

function formatDonationDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-NP", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kathmandu",
  }).format(date);
}

function resolveFont(donorName: string) {
  const includesDevanagari = /[\u0900-\u097f]/u.test(donorName);
  const hasFont = fs.existsSync(devanagariFontPath);
  if (includesDevanagari && !hasFont) {
    throw new Error(
      `Noto Sans Devanagari font is required for Nepali names. Place NotoSansDevanagari-Regular.ttf at ${devanagariFontPath}.`
    );
  }
  return includesDevanagari ? devanagariFontPath : "Helvetica";
}

function measureText(
  doc: PDFKit.PDFDocument,
  text: string,
  font: string,
  size: number,
  width: number
) {
  doc.font(font).fontSize(size);
  return doc.heightOfString(text, { width, align: "center", lineGap: 0 });
}

function fitSingleLineSize(
  doc: PDFKit.PDFDocument,
  text: string,
  font: string,
  width: number,
  preferredSize: number,
  minimumSize: number
) {
  let size = preferredSize;
  while (size > minimumSize && doc.font(font).fontSize(size).widthOfString(text) > width) {
    size -= 0.5;
  }
  return size;
}

export async function buildDonationCertificate(
  certificate: DonationCertificateData
): Promise<Buffer> {
  if (!fs.existsSync(logoPath)) {
    throw new Error(`The required e-Blood logo is missing: ${logoPath}`);
  }

  const donorFont = resolveFont(certificate.donorName);
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 0,
    compress: true,
  });
  const chunks: Buffer[] = [];

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    doc.once("error", reject);
    doc.once("end", () => resolve(Buffer.concat(chunks)));

    try {
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const contentWidth = pageWidth - 132;
      const nameWidth = pageWidth - 180;
      const nameY = 178;
      const maxNameHeight = 48;

      doc.rect(0, 0, pageWidth, pageHeight).fill(deepBurgundy);

      doc.moveTo(pageWidth - 282, 0)
        .lineTo(pageWidth, 0)
        .lineTo(pageWidth, 124)
        .closePath()
        .fill(red);
      doc.moveTo(pageWidth - 194, 0)
        .lineTo(pageWidth, 0)
        .lineTo(pageWidth, 76)
        .closePath()
        .fill(burgundy);
      doc.moveTo(pageWidth - 250, 0)
        .lineTo(pageWidth, 93)
        .strokeColor(gold)
        .lineWidth(2)
        .stroke();
      doc.moveTo(0, pageHeight - 112)
        .lineTo(0, pageHeight)
        .lineTo(160, pageHeight)
        .closePath()
        .fill(red);
      doc.moveTo(0, pageHeight - 72)
        .lineTo(115, pageHeight)
        .strokeColor(paleGold)
        .lineWidth(2)
        .stroke();
      doc.moveTo(pageWidth, pageHeight - 125)
        .lineTo(pageWidth, pageHeight)
        .lineTo(pageWidth - 182, pageHeight)
        .closePath()
        .fill(red);
      doc.moveTo(pageWidth, pageHeight - 82)
        .lineTo(pageWidth - 128, pageHeight)
        .strokeColor(paleGold)
        .lineWidth(2)
        .stroke();

      const panelPath = () => doc.moveTo(72, 0)
        .lineTo(pageWidth - 150, 0)
        .bezierCurveTo(pageWidth - 68, 0, pageWidth - 8, 42, pageWidth - 3, 104)
        .lineTo(pageWidth - 3, pageHeight - 176)
        .bezierCurveTo(pageWidth - 7, pageHeight - 92, pageWidth - 59, pageHeight - 45, pageWidth - 137, pageHeight - 34)
        .bezierCurveTo(pageWidth * 0.68, pageHeight - 12, pageWidth * 0.32, pageHeight - 12, 137, pageHeight - 34)
        .bezierCurveTo(59, pageHeight - 45, 7, pageHeight - 92, 3, pageHeight - 176)
        .lineTo(3, 174)
        .bezierCurveTo(8, 105, 34, 39, 72, 0)
        .closePath();
      doc.save();
      doc.translate(0, 7);
      panelPath().fill(deepBurgundy);
      doc.restore();
      panelPath().fill(ivory);
      panelPath().strokeColor(gold).lineWidth(4).stroke();
      doc.moveTo(78, 5)
        .lineTo(pageWidth - 150, 5)
        .bezierCurveTo(pageWidth - 72, 5, pageWidth - 14, 45, pageWidth - 9, 106)
        .strokeColor(paleGold)
        .lineWidth(1)
        .stroke();

      const badgeX = 12;
      const badgeWidth = 138;
      const badgeHeight = 150;
      const badgePath = () => doc.moveTo(badgeX, 0)
        .lineTo(badgeX + badgeWidth, 0)
        .lineTo(badgeX + badgeWidth, 73)
        .bezierCurveTo(badgeX + badgeWidth, 94, badgeX + 88, 112, badgeX + badgeWidth / 2, badgeHeight)
        .bezierCurveTo(badgeX + 28, 112, badgeX, 94, badgeX, 73)
        .closePath();
      doc.save();
      doc.translate(2, 4);
      badgePath().fill(deepBurgundy);
      doc.restore();
      badgePath().lineWidth(2).fillAndStroke(ivory, gold);
      doc.image(logoPath, badgeX + 9, 8, {
        fit: [badgeWidth - 18, 105],
        align: "center",
        valign: "center",
      });

      const titleX = 172;
      const titleWidth = pageWidth - 250;
      doc.fillColor(darkText).font("Helvetica-Bold").fontSize(36)
        .text("CERTIFICATE", titleX, 39, {
          width: titleWidth,
          align: "center",
        });
      doc.fillColor(darkText).font("Helvetica-Bold").fontSize(25)
        .text("OF APPRECIATION", titleX, 80, {
          width: titleWidth,
          align: "center",
        });
      doc.moveTo(pageWidth * 0.34, 120)
        .lineTo(pageWidth * 0.66, 120)
        .strokeColor(gold)
        .lineWidth(1.5)
        .stroke();
      doc.fillColor(darkText).font("Helvetica").fontSize(12)
        .text("PRESENTED TO", 60, 143, {
          width: pageWidth - 120,
          align: "center",
        });

      const nameFont = donorFont === "Helvetica" ? "Times-Italic" : donorFont;
      let nameSize = 40;
      let nameHeight = measureText(doc, certificate.donorName, nameFont, nameSize, nameWidth);
      while (nameHeight > maxNameHeight && nameSize > 12) {
        nameSize -= 1;
        nameHeight = measureText(doc, certificate.donorName, nameFont, nameSize, nameWidth);
      }
      doc.fillColor(burgundy).font(nameFont).fontSize(nameSize)
        .text(certificate.donorName, 75, nameY, {
          width: nameWidth,
          height: maxNameHeight,
          align: "center",
          lineGap: 0,
        });

      const recognitionY = Math.max(nameY + nameHeight + 8, 228);
      doc.fillColor(darkText).font("Helvetica-Bold").fontSize(12)
        .text("IN RECOGNITION OF YOUR GENEROUS BLOOD DONATION", 60, recognitionY, {
          width: pageWidth - 120,
          align: "center",
        });

      const detailY = recognitionY + 34;
      const detailWidth = contentWidth / 3;
      const details = [
        { label: "BLOOD GROUP", value: certificate.bloodGroup || "Not recorded" },
        { label: "DONATION DATE", value: formatDonationDate(certificate.donationDate) },
        { label: "CERTIFICATE ID", value: certificate.certificateId },
      ];
      details.forEach((detail, index) => {
        const x = (pageWidth - contentWidth) / 2 + index * detailWidth;
        doc.fillColor(darkText).font("Helvetica-Bold").fontSize(10)
          .text(detail.label, x, detailY, {
            width: detailWidth,
            align: "center",
          });
        const valueSize = fitSingleLineSize(
          doc,
          detail.value,
          "Helvetica-Bold",
          detailWidth - 20,
          15,
          8
        );
        doc.fillColor(burgundy).font("Helvetica-Bold").fontSize(valueSize)
          .text(detail.value, x + 10, detailY + 15, {
            width: detailWidth - 20,
            align: "center",
            lineBreak: false,
          });
      });

      const messageY = detailY + 64;
      doc.fillColor(darkText).font("Times-Italic").fontSize(13)
        .text(
          "Your generosity represents the true spirit of humanity. Your contribution brings hope to patients, saves lives and strengthens our community.",
          70,
          messageY,
          { width: pageWidth - 140, height: 42, align: "center", lineGap: 2 }
        );

      const signatureLineY = pageHeight - 130;
      const signatureWidth = 238;
      const signatureGap = 90;
      const signaturesLeft = (pageWidth - (signatureWidth * 2 + signatureGap)) / 2;
      signatories.forEach((signatory, index) => {
        const x = signaturesLeft + index * (signatureWidth + signatureGap);
        const imagePath = path.join(projectRoot, "signatures", signatory.file);
        if (fs.existsSync(imagePath)) {
          doc.image(imagePath, x + 77, signatureLineY - 35, {
            fit: [84, 26],
            align: "center",
            valign: "center",
          });
        }
        doc.strokeColor(darkText).lineWidth(0.9)
          .moveTo(x, signatureLineY)
          .lineTo(x + signatureWidth, signatureLineY)
          .stroke();
        doc.fillColor(darkText).font("Helvetica-Bold").fontSize(12)
          .text(signatory.name, x, signatureLineY + 7, {
            width: signatureWidth,
            align: "center",
          });
        doc.fillColor(darkText).font("Helvetica").fontSize(10)
          .text(signatory.title, x, signatureLineY + 23, {
            width: signatureWidth,
            align: "center",
          });
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

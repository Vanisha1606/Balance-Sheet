import { Capacitor } from '@capacitor/core';
import { Dialog } from '@capacitor/dialog';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { EmailComposer } from 'capacitor-email-composer';
import { exportHTMLAsPDF } from './exportAsPdf';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('Failed to encode PDF'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read PDF'));
    reader.readAsDataURL(blob);
  });
}

function toAbsolutePath(uri: string): string {
  if (uri.startsWith('file://')) {
    return decodeURIComponent(uri.replace('file://', ''));
  }
  return uri;
}

async function sharePdfViaSheet(
  base64: string,
  pdfFilename: string,
  title: string,
  text: string,
): Promise<'share'> {
  const tempFile = await Filesystem.writeFile({
    path: pdfFilename,
    data: base64,
    directory: Directory.Cache,
  });

  await Share.share({
    title,
    text,
    url: tempFile.uri,
    dialogTitle: 'Share PDF',
  });

  scheduleCleanup(pdfFilename);
  return 'share';
}

function scheduleCleanup(pdfFilename: string): void {
  setTimeout(async () => {
    try {
      await Filesystem.deleteFile({
        path: pdfFilename,
        directory: Directory.Cache,
      });
    } catch {
      /* ignore cleanup */
    }
  }, 60000);
}

async function openMailComposer(options: {
  emailSubject: string;
  emailBody: string;
  pdfFilename: string;
  base64: string;
}): Promise<void> {
  const { emailSubject, emailBody, pdfFilename, base64 } = options;

  await Filesystem.writeFile({
    path: pdfFilename,
    data: base64,
    directory: Directory.Cache,
  });

  const { uri } = await Filesystem.getUri({
    path: pdfFilename,
    directory: Directory.Cache,
  });
  const absolutePath = toAbsolutePath(uri);

  try {
    await EmailComposer.open({
      to: [],
      cc: [],
      bcc: [],
      subject: emailSubject,
      body: emailBody,
      isHtml: false,
      attachments: [
        {
          type: 'absolute',
          path: absolutePath,
          name: pdfFilename,
        },
      ],
    });
    scheduleCleanup(pdfFilename);
    return;
  } catch (absoluteError) {
    console.warn('[sendNativeEmailWithPdf] Absolute path attach failed:', absoluteError);
  }

  await EmailComposer.open({
    to: [],
    cc: [],
    bcc: [],
    subject: emailSubject,
    body: emailBody,
    isHtml: false,
    attachments: [
      {
        type: 'base64',
        path: base64,
        name: pdfFilename,
      },
    ],
  });

  scheduleCleanup(pdfFilename);
}

export type SendEmailResult = 'composer' | 'share' | 'failed' | 'cancelled';

/** Opens native Mail composer with PDF attached. Share sheet only if composer cannot open. */
export async function sendNativeEmailWithPdf(options: {
  htmlContent: string;
  documentName: string;
  subject?: string;
  body?: string;
}): Promise<SendEmailResult> {
  const { htmlContent, documentName, subject, body } = options;
  const pdfFilename = `${documentName}.pdf`;
  const emailSubject = subject ?? 'Here is your Balance Sheet';
  const emailBody =
    body ?? `Please find the attached balance sheet: ${documentName}`;

  const pdfBlob = await exportHTMLAsPDF(htmlContent, {
    filename: documentName,
    format: 'a4',
    orientation: 'portrait',
    margin: 10,
    quality: 2,
    returnBlob: true,
  });

  if (!pdfBlob) {
    return 'failed';
  }

  const base64 = await blobToBase64(pdfBlob as Blob);

  if (!Capacitor.isNativePlatform()) {
    return 'failed';
  }

  try {
    const { hasAccount } = await EmailComposer.hasAccount();

    if (!hasAccount) {
      const { value } = await Dialog.confirm({
        title: 'Set up Mail',
        message:
          'To email with PDF attached, add an account in the iOS Mail app first (Settings → Apps → Mail → Accounts). Open Share sheet instead?',
        okButtonTitle: 'Share',
        cancelButtonTitle: 'Cancel',
      });

      if (value) {
        await sharePdfViaSheet(base64, pdfFilename, pdfFilename, emailBody);
        return 'share';
      }
      return 'cancelled';
    }

    await openMailComposer({
      emailSubject,
      emailBody,
      pdfFilename,
      base64,
    });

    return 'composer';
  } catch (error) {
    console.error('[sendNativeEmailWithPdf] Email composer failed:', error);

    const { value } = await Dialog.confirm({
      title: 'Email unavailable',
      message:
        'Could not open the Mail composer. Try adding a Mail account in Settings, or use Share instead.',
      okButtonTitle: 'Share',
      cancelButtonTitle: 'Cancel',
    });

    if (value) {
      await sharePdfViaSheet(base64, pdfFilename, pdfFilename, emailBody);
      return 'share';
    }

    return 'failed';
  }
}

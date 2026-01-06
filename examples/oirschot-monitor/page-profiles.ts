/**
 * Page Extraction Profiles
 * NO AI NEEDED - Pure HTML/DOM extraction templates
 */

export interface PageProfile {
  name: string;
  urlPattern: RegExp;
  selectors: Record<string, string | string[]>;
  extractors: Record<string, (element: Element) => any>;
}

/**
 * Calendar Page Profile
 * URL: /Calendar
 */
export const CalendarPageProfile: PageProfile = {
  name: 'Calendar',
  urlPattern: /\/Calendar/i,

  selectors: {
    // Month/Year controls (text-based navigation)
    monthLinks: 'a[href*="month="], button[data-month]',
    yearLinks: 'a[href*="year="], button[data-year]',
    prevButton: 'a:contains("Vorige"), .prev, .previous',
    nextButton: 'a:contains("Volgende"), .next',

    // Meeting list
    meetings: 'a[href*="/Agenda/Index/"]',
    meetingContainer: 'tr, li, .meeting-row, .calendar-item',

    // Date headers
    dateHeaders: 'h3, .date-header, strong',
  },

  extractors: {
    meeting: (element: Element) => {
      const link = element as HTMLAnchorElement;
      const idMatch = link.href.match(/\/Agenda\/Index\/([a-f0-9-]+)/i);

      return {
        id: idMatch?.[1] || '',
        url: link.href,
        text: link.textContent?.trim() || '',
        // Extract from parent container
        fullContext: element.closest('tr, li, div')?.textContent?.trim() || ''
      };
    }
  }
};

/**
 * Meeting Detail Page Profile
 * URL: /Agenda/Index/{id}
 */
export const MeetingDetailProfile: PageProfile = {
  name: 'MeetingDetail',
  urlPattern: /\/Agenda\/Index\/[a-f0-9-]+/i,

  selectors: {
    // Metadata
    title: 'h1',
    date: 'h2',
    metadataList: 'dl',
    metadataKeys: 'dt',
    metadataValues: 'dd',

    // Specific metadata
    location: 'dt:contains("Locatie") + dd, dt:contains("Plaats") + dd',
    chairman: 'dt:contains("Voorzitter") + dd',
    broadcast: 'h3:contains("Uitzending") + div a, a[href*="uitzending"]',

    // Agenda
    agendaList: 'ol, ul.agenda',
    agendaItems: 'ol > li, ul.agenda > li',

    // Within agenda items
    itemNumber: 'strong:first-child, .number',
    itemTitle: 'strong, h4, .title',
    itemDescription: 'p, .description',

    // Nested sections
    hamerstukken: 'li:contains("Hamerstukken"), .hamerstukken',
    bespreekstukken: 'li:contains("Bespreekstukken"), .bespreekstukken',

    // Bijlagen
    attachmentSection: 'h4:contains("Bijlagen"), h3:contains("Bijlagen")',
    attachments: 'a[href*="/Agenda/Document/"]',
  },

  extractors: {
    metadata: (dlElement: Element) => {
      const metadata: Record<string, string> = {};
      const keys = dlElement.querySelectorAll('dt');
      const values = dlElement.querySelectorAll('dd');

      keys.forEach((key, index) => {
        const keyText = key.textContent?.trim().replace(':', '') || '';
        const valueText = values[index]?.textContent?.trim() || '';
        if (keyText && valueText) {
          metadata[keyText.toLowerCase()] = valueText;
        }
      });

      return metadata;
    },

    agendaItem: (liElement: Element) => {
      // Extract number
      const numberEl = liElement.querySelector('strong:first-child');
      const number = numberEl?.textContent?.trim() || '';

      // Extract title (usually after number or in heading)
      let title = '';
      const titleEl = liElement.querySelector('strong:nth-child(2), h4');
      if (titleEl) {
        title = titleEl.textContent?.trim() || '';
      } else {
        // Fallback: take first line of text
        const text = liElement.textContent?.trim() || '';
        title = text.split('\n')[0].replace(number, '').trim();
      }

      // Extract description (paragraphs)
      const descriptionEls = liElement.querySelectorAll('p');
      const description = Array.from(descriptionEls)
        .map(p => p.textContent?.trim())
        .filter(Boolean)
        .join('\n\n');

      // Check for category (hamerstuk, bespreekstuk)
      const fullText = liElement.textContent?.toLowerCase() || '';
      let category = 'regular';
      if (fullText.includes('hamerstuk')) category = 'hamerstuk';
      if (fullText.includes('bespreekstuk')) category = 'bespreekstuk';

      // Extract attachments
      const attachmentLinks = liElement.querySelectorAll('a[href*="/Agenda/Document/"]');
      const attachments = Array.from(attachmentLinks).map(link => ({
        name: link.textContent?.trim() || '',
        url: (link as HTMLAnchorElement).href,
        type: (link as HTMLAnchorElement).href.includes('.pdf') ? 'PDF' : 'Unknown'
      }));

      return {
        number,
        title: title.substring(0, 200),
        description,
        category,
        attachments
      };
    },

    attachment: (linkElement: Element) => {
      const link = linkElement as HTMLAnchorElement;
      const text = link.textContent?.trim() || '';

      // Extract filename and size if present
      const parts = text.split(/\s+/);
      const filename = parts[0] || 'Unknown';
      const size = parts[parts.length - 1] || '';

      return {
        name: filename,
        size: size.match(/\d+\s*(KB|MB|bytes)/i) ? size : '',
        url: link.href,
        type: filename.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Unknown'
      };
    }
  }
};

/**
 * All available profiles
 */
export const PageProfiles = {
  calendar: CalendarPageProfile,
  meetingDetail: MeetingDetailProfile,
};

/**
 * Get profile for URL
 */
export function getProfileForUrl(url: string): PageProfile | null {
  for (const profile of Object.values(PageProfiles)) {
    if (profile.urlPattern.test(url)) {
      return profile;
    }
  }
  return null;
}

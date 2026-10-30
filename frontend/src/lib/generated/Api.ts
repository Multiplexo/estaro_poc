/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

/** FileType */
export type FileType = "pdf" | "msg";

/** ExtractionStatus */
export type ExtractionStatus = "queued" | "running" | "succeeded" | "failed";

/**
 * Article
 * Article master data, including inventory, units, and purchasing details.
 */
export interface Article {
  /**
   * Id
   * The article's database primary key.
   */
  id?: number | null;
  /**
   * Article Number
   * The article number.
   */
  article_number: string;
  /**
   * Variant
   * The article variant; empty when no variant is specified.
   * @default ""
   */
  variant?: string;
  /**
   * Matchcode
   * The search code used to find the article.
   */
  matchcode?: string | null;
  /**
   * Description 1
   * The primary article description.
   */
  description_1?: string | null;
  /**
   * Description 2
   * The additional article description.
   */
  description_2?: string | null;
  /**
   * Sales Unit Code
   * The code for the article's sales unit.
   */
  sales_unit_code?: string | null;
  /**
   * Sales Unit Name
   * The name of the article's sales unit.
   */
  sales_unit_name?: string | null;
  /**
   * Stock Quantity
   * The quantity in stock, expressed in the stock unit.
   */
  stock_quantity: string;
  /**
   * Weight Kg
   * The article's weight in kilograms.
   */
  weight_kg: string;
  /**
   * Stock Unit Code
   * The code for the article's stock unit.
   */
  stock_unit_code?: string | null;
  /**
   * Stock Unit Name
   * The name of the article's stock unit.
   */
  stock_unit_name?: string | null;
  /**
   * Article Group Code
   * The code for the article's group.
   */
  article_group_code?: string | null;
  /**
   * Article Group Name
   * The name of the article's group.
   */
  article_group_name?: string | null;
  /**
   * Is Active
   * Whether the article is active.
   */
  is_active: boolean;
  /**
   * Commodity Code
   * The commodity classification code used for customs and trade reporting.
   */
  commodity_code?: string | null;
  /**
   * Main Supplier Code
   * The code identifying the main supplier.
   */
  main_supplier_code?: string | null;
  /**
   * Main Storage Location
   * The article's main storage location.
   */
  main_storage_location?: string | null;
  /**
   * Has Memo
   * Whether the article has an associated memo.
   */
  has_memo: boolean;
  /**
   * Manufacturer
   * The article's manufacturer.
   */
  manufacturer?: string | null;
  /**
   * Quantity Calculation Code
   * The code for the article's quantity calculation method.
   */
  quantity_calculation_code?: string | null;
  /**
   * Quantity Calculation Name
   * The name of the article's quantity calculation method.
   */
  quantity_calculation_name?: string | null;
  /**
   * Is Saleable
   * Whether the article can be sold.
   */
  is_saleable: boolean;
  /**
   * Is Purchasable
   * Whether the article can be purchased.
   */
  is_purchasable: boolean;
  /**
   * Tax Class Code
   * The code for the article's tax class.
   */
  tax_class_code?: string | null;
  /**
   * Tax Class Name
   * The name of the article's tax class.
   */
  tax_class_name?: string | null;
  /**
   * Batch Requirement
   * The article's batch tracking requirement.
   */
  batch_requirement?: string | null;
  /**
   * Batch Selection Code
   * The code for the article's batch selection method.
   */
  batch_selection_code?: string | null;
  /**
   * Batch Selection Name
   * The name of the article's batch selection method.
   */
  batch_selection_name?: string | null;
  /**
   * Intrastat Net Mass Kg
   * The net mass in kilograms used for Intrastat reporting.
   */
  intrastat_net_mass_kg?: string | null;
  /**
   * Is Exotic
   * Whether the article is marked as exotic.
   */
  is_exotic?: boolean | null;
}

/** Body_extraction */
export interface BodyExtraction {
  /** File */
  file: File | Blob;
}

/**
 * Citation
 * Wörtlicher Beleg aus einem der bereitgestellten Quellabschnitte.
 */
export interface Citation {
  /**
   * Document Id
   * Die UUID aus document_id der Quelle exakt übernehmen; niemals den Dateinamen verwenden.
   * @minLength 1
   * @maxLength 100
   */
  document_id: string;
  /**
   * Section Id
   * Exakte section_id aus diesem Dokument, z. B. page-1-item-3-prov-1.
   * @minLength 1
   * @maxLength 200
   */
  section_id: string;
  /**
   * Quote
   * Kleinster wörtlicher Textausschnitt, der dieses Feld belegt; nicht die gesamte Zeile. Schreibweise und Leerzeichen beibehalten.
   * @minLength 1
   * @maxLength 2000
   */
  quote: string;
  bbox?: CitationBBox | null;
  /** Page Number */
  page_number?: number | null;
  /** Page Width */
  page_width?: number | null;
  /** Page Height */
  page_height?: number | null;
}

/** CitationBBox */
export interface CitationBBox {
  /** L */
  l: number;
  /** T */
  t: number;
  /** R */
  r: number;
  /** B */
  b: number;
  /**
   * Coord Origin
   * @default "TOPLEFT"
   */
  coord_origin?: "TOPLEFT";
}

/**
 * Customer
 * Customer identity, address, commercial terms, and tax details.
 */
export interface Customer {
  /**
   * Id
   * The customer's database UUID primary key.
   * @format uuid
   */
  id?: string;
  /**
   * Customer Number
   * The unique, non-blank customer number.
   */
  customer_number: string;
  /**
   * Matchcode
   * The search code used to find the customer.
   */
  matchcode?: string | null;
  /**
   * Salutation
   * The customer's salutation.
   */
  salutation?: string | null;
  /**
   * Name
   * The customer's name.
   */
  name?: string | null;
  /**
   * Name Addition
   * Additional information for the customer's name.
   */
  name_addition?: string | null;
  /**
   * Print Process Variant Code
   * The code for the customer's print process variant.
   */
  print_process_variant_code?: string | null;
  /**
   * Address Group Code
   * The code for the customer's address group.
   */
  address_group_code?: string | null;
  /**
   * Address Group Name
   * The name of the customer's address group.
   */
  address_group_name?: string | null;
  /**
   * Country Code
   * The code for the customer's country.
   */
  country_code?: string | null;
  /**
   * Country Name
   * The name of the customer's country.
   */
  country_name?: string | null;
  /**
   * Postal Code
   * The customer's postal code.
   */
  postal_code?: string | null;
  /**
   * City
   * The customer's city.
   */
  city?: string | null;
  /**
   * Phone
   * The customer's telephone number.
   */
  phone?: string | null;
  /**
   * Currency Code
   * The code for the customer's currency.
   */
  currency_code?: string | null;
  /**
   * Currency Name
   * The name of the customer's currency.
   */
  currency_name?: string | null;
  /**
   * Payment Terms Code
   * The code for the customer's payment terms.
   */
  payment_terms_code?: string | null;
  /**
   * Payment Terms Name
   * The name of the customer's payment terms.
   */
  payment_terms_name?: string | null;
  /**
   * Representative Code
   * The code identifying the customer's representative.
   */
  representative_code?: string | null;
  /**
   * Price List Code
   * The code for the customer's price list.
   */
  price_list_code?: string | null;
  /**
   * Price List Name
   * The name of the customer's price list.
   */
  price_list_name?: string | null;
  /**
   * Customer Group Code
   * The code for the customer's group.
   */
  customer_group_code?: string | null;
  /**
   * Customer Group Name
   * The name of the customer's group.
   */
  customer_group_name?: string | null;
  /**
   * Language Code
   * The code for the customer's language.
   */
  language_code?: string | null;
  /**
   * Language Name
   * The name of the customer's language.
   */
  language_name?: string | null;
  /**
   * Delivery Blocked
   * Whether deliveries to the customer are blocked.
   */
  delivery_blocked: boolean;
  /**
   * Vat Id
   * The customer's VAT identification number.
   */
  vat_id?: string | null;
  /**
   * Is Active
   * Whether the customer is active.
   */
  is_active: boolean;
  /**
   * Taxation Type Code
   * The code for the customer's taxation type.
   */
  taxation_type_code?: string | null;
  /**
   * Taxation Type Name
   * The name of the customer's taxation type.
   */
  taxation_type_name?: string | null;
  /**
   * Admission Date
   * The date the customer was admitted to the customer master data.
   */
  admission_date?: string | null;
  /**
   * Eu Country Code
   * The EU country code used for tax reporting.
   */
  eu_country_code?: string | null;
  /**
   * Eu Country Name
   * The EU country name used for tax reporting.
   */
  eu_country_name?: string | null;
  /**
   * Invoice Cycle Code
   * The code for the customer's invoicing cycle.
   */
  invoice_cycle_code?: string | null;
  /**
   * Invoice Cycle Name
   * The name of the customer's invoicing cycle.
   */
  invoice_cycle_name?: string | null;
  /**
   * Discount List Code
   * The code for the customer's discount list.
   */
  discount_list_code?: string | null;
  /**
   * Discount List Name
   * The name of the customer's discount list.
   */
  discount_list_name?: string | null;
}

/** DocumentUrl */
export interface DocumentUrl {
  /** Url */
  url: string;
}

/**
 * ExtractedField
 * Ein extrahierter Wert mit seinen wörtlichen Quellenbelegen.
 */
export interface ExtractedField {
  /**
   * Value
   * Lesbarer extrahierter Wert in der ursprünglichen Einheit. Fehlende Einheiten nicht ergänzen und Mengen nicht umrechnen. null, wenn die Angabe in den Quellen fehlt.
   */
  value: string | null;
  /**
   * Citations
   * Mindestens ein wörtlicher Beleg für jeden vorhandenen Wert. Bei Widersprüchen alle abweichenden Quellenangaben belegen. Nur bei fehlenden Angaben leer lassen.
   * @maxItems 8
   */
  citations: Citation[];
  /**
   * Status
   * present bei belegten Angaben; missing bei fehlenden Angaben; conflict bei widersprüchlichen Quellen. Bei Widersprüchen beide Werte und ihre Belege beibehalten.
   */
  status: "present" | "missing" | "conflict";
  /**
   * Note
   * Ein kurzer deutscher Satz zu fehlenden oder widersprüchlichen Angaben. Andernfalls null; keine Überlegungen ausgeben.
   */
  note?: string | null;
}

/**
 * ExtractedItem
 * Eine angefragte Position, getrennt von den übrigen Positionen.
 */
export interface ExtractedItem {
  /** Artikelart und ausdrückliche Ausführung, z. B. nahtloses Rohr, geschweißtes Rohr, Rundstahl oder Rohrbogen. Kunden-Artikelnummern sind keine ESTARO-Artikelnummern. */
  article: ExtractedField;
  /** Werkstoffgüte, z. B. 1.4841. */
  material: ExtractedField;
  /** Benannte Abmessungen: Außendurchmesser, Wandstärke, Breite, Dicke, Länge bzw. Längenbereich und Fixlänge, jeweils mit belegter Einheit. Handels-/Herstelllänge ohne Zahlenwert nicht zu einer festen Länge ergänzen. */
  dimensions: ExtractedField;
  /** Ausgewiesene Bestellmenge der Position. Meter-/Kilogrammmenge von Stabanzahl, Stücklänge, Einzelgewicht und Gesamtgewicht trennen. Alternative Mengen gehören zu alternatives. */
  quantity: ExtractedField;
  /** Mengeneinheit, z. B. m, Stück oder kg. Keine Umrechnung. */
  unit: ExtractedField;
  /** Normen, Toleranzen, Stabanzahl, Qualität, Charge, Prüfungen, Kennzeichnung, verbotene Ursprünge, Verpackung und Kundenwünsche. Bedingte Anforderungen ausdrücklich als bedingt wiedergeben. */
  requirements: ExtractedField;
  /** Ausdrücklich angefragte Alternativen für dieselbe Position. */
  alternatives: ExtractedField;
  /** Ausdrücklich angefragte Zertifikate: APZ/WAZ/3.1, Ursprungszeugnis, Umstempelbescheinigung oder Lieferantenerklärung. Diese Dokumentarten nicht gleichsetzen; Negationen und Bedingungen erhalten. */
  certificates: ExtractedField;
}

/** ExtractionJobStatus */
export interface ExtractionJobStatus {
  /**
   * Id
   * @format uuid
   */
  id: string;
  /** Source Key */
  source_key: string | null;
  /** Inquiry Id */
  inquiry_id: string | null;
  /** Document Id */
  document_id: string | null;
  status: ExtractionStatus;
  /** Current Step */
  current_step: string | null;
  /** Completed Steps */
  completed_steps: number;
  /**
   * Total Steps
   * @default 4
   */
  total_steps?: number;
  /** Error */
  error: string | null;
  /**
   * Created At
   * @format date-time
   */
  created_at: string;
  /** Started At */
  started_at: string | null;
  /** Finished At */
  finished_at: string | null;
}

/** HTTPValidationError */
export interface HTTPValidationError {
  /** Detail */
  detail?: ValidationError[];
}

/**
 * Inquiry
 * An inquiry with its ordered documents.
 */
export interface Inquiry {
  /**
   * Id
   * The inquiry's UUID.
   * @format uuid
   */
  id?: string;
  /**
   * Created At
   * When the inquiry was created.
   * @format date-time
   */
  created_at: string;
  /**
   * Deletion Requested At
   * When deletion was requested, if any.
   */
  deletion_requested_at?: string | null;
  /**
   * Deletion Retry At
   * When to retry deletion, if scheduled.
   */
  deletion_retry_at?: string | null;
  /** Documents */
  documents?: InquiryDocument[];
}

/**
 * InquiryDocument
 * A file belonging to an inquiry, optionally extracted from another file.
 */
export interface InquiryDocument {
  /**
   * Id
   * The document's UUID.
   * @format uuid
   */
  id?: string;
  /**
   * Inquiry Id
   * The inquiry owning this document.
   * @format uuid
   */
  inquiry_id: string;
  /**
   * Filename
   * The document's filename.
   */
  filename: string;
  /**
   * Parent Document Id
   * The source document's UUID, if any.
   */
  parent_document_id?: string | null;
  /** The document's file format. */
  file_type: FileType;
  /** Source Key */
  source_key?: string | null;
}

/**
 * InquiryExtraction
 * Eingehende ESTARO-Anfrage mit wörtlichen Belegen für jedes extrahierte Feld.
 */
export interface InquiryExtraction {
  /** Ursprünglich anfragendes Unternehmen aus Signatur oder PDF-Absender. Niemals ESTARO oder einen internen Weiterleiter angeben. */
  customer: ExtractedField;
  /** Ausdrücklich dem anfragenden Kunden zugeordnete ESTARO-Kundennummer. Keine Lieferantennummer, Empfänger-Kundennummer oder Divers-Vorgabe. */
  customer_number?: ExtractedField;
  /** Ort/Standort des anfragenden Unternehmens, nicht der Lieferort. */
  customer_location?: ExtractedField;
  /** Name des zuständigen Ansprechpartners beim anfragenden Kunden aus Nachricht, Signatur oder 'Ihr Zeichen'. Kein ESTARO-Mitarbeiter. */
  contact_name?: ExtractedField;
  /** E-Mail-Adresse des Kunden-Ansprechpartners; ersatzweise ausdrücklich zugehörige Kunden-Kontaktadresse. Kein interner Weiterleiter. */
  contact_email?: ExtractedField;
  /** Telefon/Mobilnummer des Kunden-Ansprechpartners, ggf. gekennzeichnete Faxnummer. Bei mehreren Nummern deren Zuordnung erhalten. */
  contact_phone?: ExtractedField;
  /** Explizite Anfragenummer des Kunden, auch unter 'Ihre Belegnummer'. Keine Bestell-, Zeichnungs-, Angebots- oder Positionsnummer. */
  inquiry_number?: ExtractedField;
  /** Kundenreferenz für 'Ihre Belegnummer': Anfragenummer übernehmen, sofern keine separate Kunden-Belegnummer angegeben ist. Keine interne ESTARO-Angebotsnummer und keine erfundenen Platzhalter. */
  document_number?: ExtractedField;
  /** Ausdrücklich genannte Angebotsgültigkeit als Datum oder Zeitraum. Von Angebotsabgabefrist und Liefertermin trennen. Keine interne 1-Tag-Vorgabe übernehmen oder ein Datum berechnen. */
  offer_valid_until?: ExtractedField;
  /** Weitere ausdrücklich benannte Referenzen mit Typ, z. B. Bestell- oder Zeichnungsnummer. Die Anfragenummer separat erfassen. */
  reference_number: ExtractedField;
  /**
   * Items
   * Jede angefragte Position einzeln; keine Positionen erfinden.
   * @maxItems 100
   */
  items: ExtractedItem[];
  /** Anforderungen und Wünsche, die für die gesamte Anfrage gelten. */
  requirements: ExtractedField;
  /** Ausdrücklich gewünschter Liefertermin oder Lieferzeitraum, auch je Position mit Positionsbezug. Originalangabe erhalten, z. B. KW 48 oder schnellstmöglich. Keine Frist aus dem Dokumentdatum ableiten. */
  delivery_date?: ExtractedField;
}

/** InquiryExtractionSnapshot */
export interface InquiryExtractionSnapshot {
  /**
   * Id
   * @format uuid
   */
  id: string;
  /**
   * Inquiry Id
   * @format uuid
   */
  inquiry_id: string;
  /** Job Id */
  job_id: string | null;
  /**
   * Created At
   * @format date-time
   */
  created_at: string;
  /** Schema Version */
  schema_version: number;
  /** Model */
  model: string;
  /** Prompt Version */
  prompt_version: string;
  /** Eingehende ESTARO-Anfrage mit wörtlichen Belegen für jedes extrahierte Feld. */
  result: InquiryExtraction;
}

/**
 * RootResponse
 * Basic application response.
 */
export interface RootResponse {
  /**
   * Message
   * @default "Hello World"
   */
  message?: string;
}

/** ValidationError */
export interface ValidationError {
  /** Location */
  loc: (string | number)[];
  /** Message */
  msg: string;
  /** Error Type */
  type: string;
  /** Input */
  input?: any;
  /** Context */
  ctx?: object;
}

import type {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  HeadersDefaults,
  ResponseType,
} from "axios";
import axios from "axios";

export type QueryParamsType = Record<string | number, any>;

export interface FullRequestParams
  extends Omit<AxiosRequestConfig, "data" | "params" | "url" | "responseType"> {
  /** set parameter to `true` for call `securityWorker` for this request */
  secure?: boolean;
  /** request path */
  path: string;
  /** content type of request body */
  type?: ContentType;
  /** query params */
  query?: QueryParamsType;
  /** format of response (i.e. response.json() -> format: "json") */
  format?: ResponseType;
  /** request body */
  body?: unknown;
}

export type RequestParams = Omit<
  FullRequestParams,
  "body" | "method" | "query" | "path"
>;

export interface ApiConfig<SecurityDataType = unknown>
  extends Omit<AxiosRequestConfig, "data" | "cancelToken"> {
  securityWorker?: (
    securityData: SecurityDataType | null,
  ) => Promise<AxiosRequestConfig | void> | AxiosRequestConfig | void;
  secure?: boolean;
  format?: ResponseType;
}

export type ContentType =
  | "application/json"
  | "application/vnd.api+json"
  | "multipart/form-data"
  | "application/x-www-form-urlencoded"
  | "text/plain";

export class HttpClient<SecurityDataType = unknown> {
  public instance: AxiosInstance;
  private securityData: SecurityDataType | null = null;
  private securityWorker?: ApiConfig<SecurityDataType>["securityWorker"];
  private secure?: boolean;
  private format?: ResponseType;

  constructor({
    securityWorker,
    secure,
    format,
    ...axiosConfig
  }: ApiConfig<SecurityDataType> = {}) {
    this.instance = axios.create({
      ...axiosConfig,
      baseURL: axiosConfig.baseURL || "",
    });
    this.secure = secure;
    this.format = format;
    this.securityWorker = securityWorker;
  }

  public setSecurityData = (data: SecurityDataType | null) => {
    this.securityData = data;
  };

  protected mergeRequestParams(
    params1: AxiosRequestConfig,
    params2?: AxiosRequestConfig,
  ): AxiosRequestConfig {
    const method = params1.method || (params2 && params2.method);

    return {
      ...this.instance.defaults,
      ...params1,
      ...(params2 || {}),
      headers: {
        ...((method &&
          this.instance.defaults.headers[
            method.toLowerCase() as keyof HeadersDefaults
          ]) ||
          {}),
        ...(params1.headers || {}),
        ...((params2 && params2.headers) || {}),
      },
    };
  }

  protected stringifyFormItem(formItem: unknown) {
    if (typeof formItem === "object" && formItem !== null) {
      return JSON.stringify(formItem);
    } else {
      return `${formItem}`;
    }
  }

  protected createFormData(input: Record<string, unknown>): FormData {
    if (input instanceof FormData) {
      return input;
    }
    return Object.keys(input || {}).reduce((formData, key) => {
      const property = input[key];
      const propertyContent: any[] =
        property instanceof Array ? property : [property];

      for (const formItem of propertyContent) {
        const isFileType = formItem instanceof Blob || formItem instanceof File;
        formData.append(
          key,
          isFileType ? formItem : this.stringifyFormItem(formItem),
        );
      }

      return formData;
    }, new FormData());
  }

  public request = async <T = any, _E = any>({
    secure,
    path,
    type,
    query,
    format,
    body,
    ...params
  }: FullRequestParams): Promise<AxiosResponse<T>> => {
    const secureParams =
      ((typeof secure === "boolean" ? secure : this.secure) &&
        this.securityWorker &&
        (await this.securityWorker(this.securityData))) ||
      {};
    const requestParams = this.mergeRequestParams(params, secureParams);
    const responseFormat = format || this.format || undefined;

    if (
      type === "multipart/form-data" &&
      body &&
      body !== null &&
      typeof body === "object"
    ) {
      body = this.createFormData(body as Record<string, unknown>);
    }

    if (
      type === "text/plain" &&
      body &&
      body !== null &&
      typeof body !== "string"
    ) {
      body = JSON.stringify(body);
    }

    return this.instance.request({
      ...requestParams,
      headers: {
        ...(requestParams.headers || {}),
        ...(type ? { "Content-Type": type } : {}),
      },
      params: query,
      responseType: responseFormat,
      data: body,
      url: path,
    });
  };
}

/**
 * @title Estaro API
 * @version 0.1.0
 */
export class Api<
  SecurityDataType extends unknown,
> extends HttpClient<SecurityDataType> {
  /**
   * @description Return the application's root response.
   *
   * @name GetRoot
   * @summary Root
   * @request GET:/
   */
  getRoot = (params: RequestParams = {}) =>
    this.request<RootResponse, any>({
      path: `/`,
      method: "GET",
      format: "json",
      ...params,
    });

  articles = {
    /**
     * @description Return a page of articles.
     *
     * @tags articles
     * @name ListArticles
     * @summary List Articles
     * @request GET:/articles
     */
    listArticles: (
      query?: {
        /**
         * Offset
         * @min 0
         * @default 0
         */
        offset?: number;
        /**
         * Limit
         * @min 1
         * @max 1000
         * @default 100
         */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<Article[], HTTPValidationError>({
        path: `/articles`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * @description Return an article by ID.
     *
     * @tags articles
     * @name GetArticleById
     * @summary Get Article By Id
     * @request GET:/articles/{article_id}
     */
    getArticleById: (articleId: number, params: RequestParams = {}) =>
      this.request<Article, HTTPValidationError>({
        path: `/articles/${articleId}`,
        method: "GET",
        format: "json",
        ...params,
      }),
  };
  customers = {
    /**
     * @description Return a page of customers.
     *
     * @tags customers
     * @name ListCustomers
     * @summary List Customers
     * @request GET:/customers
     */
    listCustomers: (
      query?: {
        /**
         * Offset
         * @min 0
         * @default 0
         */
        offset?: number;
        /**
         * Limit
         * @min 1
         * @max 1000
         * @default 100
         */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<Customer[], HTTPValidationError>({
        path: `/customers`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * @description Return a customer by ID.
     *
     * @tags customers
     * @name GetCustomerById
     * @summary Get Customer By Id
     * @request GET:/customers/{customer_id}
     */
    getCustomerById: (customerId: string, params: RequestParams = {}) =>
      this.request<Customer, HTTPValidationError>({
        path: `/customers/${customerId}`,
        method: "GET",
        format: "json",
        ...params,
      }),
  };
  inquiries = {
    /**
     * @description Return a page of inquiries.
     *
     * @tags inquiries
     * @name ListInquiries
     * @summary List Inquiries
     * @request GET:/inquiries
     */
    listInquiries: (
      query?: {
        /**
         * Offset
         * @min 0
         * @default 0
         */
        offset?: number;
        /**
         * Limit
         * @min 1
         * @max 1000
         * @default 100
         */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<Inquiry[], HTTPValidationError>({
        path: `/inquiries`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * @description Return an inquiry by ID.
     *
     * @tags inquiries
     * @name GetInquiryById
     * @summary Get Inquiry By Id
     * @request GET:/inquiries/{inquiry_id}
     */
    getInquiryById: (inquiryId: string, params: RequestParams = {}) =>
      this.request<Inquiry, HTTPValidationError>({
        path: `/inquiries/${inquiryId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags inquiries
     * @name DeleteInquiry
     * @summary Delete Inquiry
     * @request DELETE:/inquiries/{inquiry_id}
     */
    deleteInquiry: (inquiryId: string, params: RequestParams = {}) =>
      this.request<void, HTTPValidationError>({
        path: `/inquiries/${inquiryId}`,
        method: "DELETE",
        ...params,
      }),

    /**
     * No description
     *
     * @tags inquiries
     * @name ListInquiryExtractions
     * @summary List Inquiry Extractions
     * @request GET:/inquiries/{inquiry_id}/extractions
     */
    listInquiryExtractions: (
      inquiryId: string,
      query?: {
        /**
         * Offset
         * @min 0
         * @default 0
         */
        offset?: number;
        /**
         * Limit
         * @min 1
         * @max 1000
         * @default 100
         */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<InquiryExtractionSnapshot[], HTTPValidationError>({
        path: `/inquiries/${inquiryId}/extractions`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags inquiries
     * @name GetInquiryDocumentUrl
     * @summary Get Inquiry Document Url
     * @request GET:/inquiries/{inquiry_id}/documents/{document_id}/url
     */
    getInquiryDocumentUrl: (
      inquiryId: string,
      documentId: string,
      params: RequestParams = {},
    ) =>
      this.request<DocumentUrl, HTTPValidationError>({
        path: `/inquiries/${inquiryId}/documents/${documentId}/url`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags inquiries
     * @name DownloadInquiryDocument
     * @summary Download Inquiry Document
     * @request GET:/inquiries/{inquiry_id}/documents/{document_id}
     */
    downloadInquiryDocument: (
      inquiryId: string,
      documentId: string,
      params: RequestParams = {},
    ) =>
      this.request<Blob, HTTPValidationError>({
        path: `/inquiries/${inquiryId}/documents/${documentId}`,
        method: "GET",
        ...params,
      }),
  };
  extractions = {
    /**
     * No description
     *
     * @tags extractions
     * @name Extraction
     * @summary Submit Extraction
     * @request POST:/extractions
     */
    extraction: (data: BodyExtraction, params: RequestParams = {}) =>
      this.request<ExtractionJobStatus, HTTPValidationError>({
        path: `/extractions`,
        method: "POST",
        body: data,
        type: "multipart/form-data",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags extractions
     * @name GetExtractionStatus
     * @summary Get Extraction Status
     * @request GET:/extractions/{job_id}
     */
    getExtractionStatus: (jobId: string, params: RequestParams = {}) =>
      this.request<ExtractionJobStatus, HTTPValidationError>({
        path: `/extractions/${jobId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags extractions
     * @name GetExtractionResult
     * @summary Get Extraction Result
     * @request GET:/extractions/{job_id}/result
     */
    getExtractionResult: (jobId: string, params: RequestParams = {}) =>
      this.request<InquiryExtractionSnapshot, HTTPValidationError>({
        path: `/extractions/${jobId}/result`,
        method: "GET",
        format: "json",
        ...params,
      }),
  };
}

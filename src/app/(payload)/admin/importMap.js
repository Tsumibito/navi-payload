import GenerateSlugButtonDefault, {
  GenerateSlugButton as GenerateSlugButtonNamed,
} from '../../../components/GenerateSlugButton';
import GenerateSummaryButtonDefault, {
  GenerateSummaryButton as GenerateSummaryButtonNamed,
} from '../../../components/GenerateSummaryButton';
import GenerateTagSummaryButtonDefault, {
  GenerateTagSummaryButton as GenerateTagSummaryButtonNamed,
} from '../../../components/GenerateTagSummaryButton';
import DefineTagsButtonDefault, {
  DefineTagsButton as DefineTagsButtonNamed,
} from '../../../components/DefineTagsButton';
import SeoLengthIndicatorDefault, {
  SeoMetaDescriptionLengthIndicator,
  SeoTitleLengthIndicator,
} from '../../../components/SeoLengthIndicator';
import SeoKeywordManagerDefault, {
  SeoKeywordManager,
} from '../../../components/SeoKeywordManager';
import FocusKeyphraseAnalyzerDefault, {
  FocusKeyphraseAnalyzer,
} from '../../../components/FocusKeyphraseAnalyzer';
import OgImageActionsDefault, {
  OgImageActions,
} from '../../../components/OgImageActions';
import {
  AlignFeatureClient,
  BoldFeatureClient,
  ChecklistFeatureClient,
  HeadingFeatureClient,
  HorizontalRuleFeatureClient,
  InlineCodeFeatureClient,
  InlineToolbarFeatureClient,
  ItalicFeatureClient,
  LinkFeatureClient,
  OrderedListFeatureClient,
  ParagraphFeatureClient,
  RelationshipFeatureClient,
  StrikethroughFeatureClient,
  SubscriptFeatureClient,
  SuperscriptFeatureClient,
  UnderlineFeatureClient,
  UnorderedListFeatureClient,
  UploadFeatureClient,
  BlockquoteFeatureClient,
  IndentFeatureClient,
} from '@payloadcms/richtext-lexical/client';
import {
  LexicalDiffComponent,
  RscEntryLexicalCell,
  RscEntryLexicalField,
} from '@payloadcms/richtext-lexical/rsc';
import S3ClientUploadHandlerStub from '../../../components/S3ClientUploadHandlerStub';

export const importMap = {
  "/src/components/GenerateSlugButton#GenerateSlugButton": GenerateSlugButtonNamed,
  "/src/components/GenerateSlugButton#default": GenerateSlugButtonDefault,
  "/src/components/GenerateSummaryButton#GenerateSummaryButton": GenerateSummaryButtonNamed,
  "/src/components/GenerateSummaryButton#default": GenerateSummaryButtonDefault,
  "/src/components/GenerateTagSummaryButton#GenerateTagSummaryButton": GenerateTagSummaryButtonNamed,
  "/src/components/GenerateTagSummaryButton#default": GenerateTagSummaryButtonDefault,
  "/src/components/DefineTagsButton#DefineTagsButton": DefineTagsButtonNamed,
  "/src/components/DefineTagsButton#default": DefineTagsButtonDefault,
  "/src/components/SeoLengthIndicator#SeoTitleLengthIndicator": SeoTitleLengthIndicator,
  "/src/components/SeoLengthIndicator#SeoMetaDescriptionLengthIndicator": SeoMetaDescriptionLengthIndicator,
  "/src/components/SeoLengthIndicator#default": SeoLengthIndicatorDefault,
  "/src/components/SeoKeywordManager#SeoKeywordManager": SeoKeywordManager,
  "/src/components/SeoKeywordManager#default": SeoKeywordManagerDefault,
  "/src/components/FocusKeyphraseAnalyzer#FocusKeyphraseAnalyzer": FocusKeyphraseAnalyzer,
  "/src/components/FocusKeyphraseAnalyzer#default": FocusKeyphraseAnalyzerDefault,
  "/src/components/OgImageActions#OgImageActions": OgImageActions,
  "/src/components/OgImageActions#default": OgImageActionsDefault,
  "@payloadcms/richtext-lexical/rsc#RscEntryLexicalCell": RscEntryLexicalCell,
  "@payloadcms/richtext-lexical/rsc#RscEntryLexicalField": RscEntryLexicalField,
  "@payloadcms/richtext-lexical/rsc#LexicalDiffComponent": LexicalDiffComponent,
  "@payloadcms/richtext-lexical/client#HorizontalRuleFeatureClient": HorizontalRuleFeatureClient,
  "@payloadcms/richtext-lexical/client#LinkFeatureClient": LinkFeatureClient,
  "@payloadcms/richtext-lexical/client#OrderedListFeatureClient": OrderedListFeatureClient,
  "@payloadcms/richtext-lexical/client#UnorderedListFeatureClient": UnorderedListFeatureClient,
  "@payloadcms/richtext-lexical/client#InlineCodeFeatureClient": InlineCodeFeatureClient,
  "@payloadcms/richtext-lexical/client#StrikethroughFeatureClient": StrikethroughFeatureClient,
  "@payloadcms/richtext-lexical/client#UnderlineFeatureClient": UnderlineFeatureClient,
  "@payloadcms/richtext-lexical/client#BoldFeatureClient": BoldFeatureClient,
  "@payloadcms/richtext-lexical/client#ItalicFeatureClient": ItalicFeatureClient,
  "@payloadcms/richtext-lexical/client#HeadingFeatureClient": HeadingFeatureClient,
  "@payloadcms/richtext-lexical/client#ParagraphFeatureClient": ParagraphFeatureClient,
  "@payloadcms/richtext-lexical/client#SubscriptFeatureClient": SubscriptFeatureClient,
  "@payloadcms/richtext-lexical/client#SuperscriptFeatureClient": SuperscriptFeatureClient,
  "@payloadcms/richtext-lexical/client#AlignFeatureClient": AlignFeatureClient,
  "@payloadcms/richtext-lexical/client#IndentFeatureClient": IndentFeatureClient,
  "@payloadcms/richtext-lexical/client#ChecklistFeatureClient": ChecklistFeatureClient,
  "@payloadcms/richtext-lexical/client#RelationshipFeatureClient": RelationshipFeatureClient,
  "@payloadcms/richtext-lexical/client#BlockquoteFeatureClient": BlockquoteFeatureClient,
  "@payloadcms/richtext-lexical/client#UploadFeatureClient": UploadFeatureClient,
  "@payloadcms/richtext-lexical/client#InlineToolbarFeatureClient": InlineToolbarFeatureClient,
  "@payloadcms/storage-s3/client#ClientUploadHandler": S3ClientUploadHandlerStub,
  "@payloadcms/storage-s3/client#S3ClientUploadHandler": S3ClientUploadHandlerStub,
};

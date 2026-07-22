import { RscEntryLexicalCell as RscEntryLexicalCell_44fe37237e0ebf4470c9990d8cb7b07e } from '@payloadcms/richtext-lexical/rsc'
import { RscEntryLexicalField as RscEntryLexicalField_44fe37237e0ebf4470c9990d8cb7b07e } from '@payloadcms/richtext-lexical/rsc'
import { LexicalDiffComponent as LexicalDiffComponent_44fe37237e0ebf4470c9990d8cb7b07e } from '@payloadcms/richtext-lexical/rsc'
import { RelationshipFeatureClient as RelationshipFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { UploadFeatureClient as UploadFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { HorizontalRuleFeatureClient as HorizontalRuleFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { LinkFeatureClient as LinkFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { ChecklistFeatureClient as ChecklistFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { OrderedListFeatureClient as OrderedListFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { UnorderedListFeatureClient as UnorderedListFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { IndentFeatureClient as IndentFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { AlignFeatureClient as AlignFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { BlockquoteFeatureClient as BlockquoteFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { InlineCodeFeatureClient as InlineCodeFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { StrikethroughFeatureClient as StrikethroughFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { UnderlineFeatureClient as UnderlineFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { BoldFeatureClient as BoldFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { ItalicFeatureClient as ItalicFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { HeadingFeatureClient as HeadingFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { ParagraphFeatureClient as ParagraphFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { InlineToolbarFeatureClient as InlineToolbarFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { FixedToolbarFeatureClient as FixedToolbarFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { SeoTitleLengthIndicator as SeoTitleLengthIndicator_9cb0b91071cf3d3dea25392975df1b03 } from '../../../../src/components/SeoLengthIndicator'
import { SeoMetaDescriptionLengthIndicator as SeoMetaDescriptionLengthIndicator_9cb0b91071cf3d3dea25392975df1b03 } from '../../../../src/components/SeoLengthIndicator'
import { FocusKeyphraseAnalyzer as FocusKeyphraseAnalyzer_428f656e50e600e9ec2123f9ddbbe583 } from '../../../../src/components/FocusKeyphraseAnalyzer'
import { SeoKeywordManager as SeoKeywordManager_462b8dacad1901b9c82d0b9600d432a4 } from '../../../../src/components/SeoKeywordManager'
import { EditorialWorkflowButton as EditorialWorkflowButton_343be80d4b57a314839e3f92ff0dba96 } from '../../../../src/components/EditorialWorkflowButton'
import { GenerateSlugButton as GenerateSlugButton_68a79d9f857f4400dd1a5091bb544cf7 } from '../../../../src/components/GenerateSlugButton'
import { GenerateImageAltButton as GenerateImageAltButton_9fc8e6b15e5f66bee095735f06ab4344 } from '../../../../src/components/EditorialFieldActions'
import { GenerateSummaryButton as GenerateSummaryButton_8f650de01469eb4d0811a209b22855c9 } from '../../../../src/components/GenerateSummaryButton'
import { DefineTagsButton as DefineTagsButton_3f6daf68463bf4647f221b892f000bd2 } from '../../../../src/components/DefineTagsButton'
import { GenerateSocialImagesButton as GenerateSocialImagesButton_9fc8e6b15e5f66bee095735f06ab4344 } from '../../../../src/components/EditorialFieldActions'
import { GenerateSeoFieldsButton as GenerateSeoFieldsButton_9fc8e6b15e5f66bee095735f06ab4344 } from '../../../../src/components/EditorialFieldActions'
import { GenerateFaqFieldsButton as GenerateFaqFieldsButton_9fc8e6b15e5f66bee095735f06ab4344 } from '../../../../src/components/EditorialFieldActions'
import { AIFaqGeneratorButton as AIFaqGeneratorButton_989aa69d921d544baad3872686b8d37d } from '../../../../src/components/AIFaqGeneratorButton'
import { S3ClientUploadHandler as S3ClientUploadHandler_f97aa6c64367fa259c5bc0567239ef24 } from '@payloadcms/storage-s3/client'
import { CollectionCards as CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1 } from '@payloadcms/next/rsc'

/** @type import('payload').ImportMap */
export const importMap = {
  "@payloadcms/richtext-lexical/rsc#RscEntryLexicalCell": RscEntryLexicalCell_44fe37237e0ebf4470c9990d8cb7b07e,
  "@payloadcms/richtext-lexical/rsc#RscEntryLexicalField": RscEntryLexicalField_44fe37237e0ebf4470c9990d8cb7b07e,
  "@payloadcms/richtext-lexical/rsc#LexicalDiffComponent": LexicalDiffComponent_44fe37237e0ebf4470c9990d8cb7b07e,
  "@payloadcms/richtext-lexical/client#RelationshipFeatureClient": RelationshipFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#UploadFeatureClient": UploadFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#HorizontalRuleFeatureClient": HorizontalRuleFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#LinkFeatureClient": LinkFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#ChecklistFeatureClient": ChecklistFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#OrderedListFeatureClient": OrderedListFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#UnorderedListFeatureClient": UnorderedListFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#IndentFeatureClient": IndentFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#AlignFeatureClient": AlignFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#BlockquoteFeatureClient": BlockquoteFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#InlineCodeFeatureClient": InlineCodeFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#StrikethroughFeatureClient": StrikethroughFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#UnderlineFeatureClient": UnderlineFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#BoldFeatureClient": BoldFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#ItalicFeatureClient": ItalicFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#HeadingFeatureClient": HeadingFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#ParagraphFeatureClient": ParagraphFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#InlineToolbarFeatureClient": InlineToolbarFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#FixedToolbarFeatureClient": FixedToolbarFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "/src/components/SeoLengthIndicator#SeoTitleLengthIndicator": SeoTitleLengthIndicator_9cb0b91071cf3d3dea25392975df1b03,
  "/src/components/SeoLengthIndicator#SeoMetaDescriptionLengthIndicator": SeoMetaDescriptionLengthIndicator_9cb0b91071cf3d3dea25392975df1b03,
  "/src/components/FocusKeyphraseAnalyzer#FocusKeyphraseAnalyzer": FocusKeyphraseAnalyzer_428f656e50e600e9ec2123f9ddbbe583,
  "/src/components/SeoKeywordManager#SeoKeywordManager": SeoKeywordManager_462b8dacad1901b9c82d0b9600d432a4,
  "/src/components/EditorialWorkflowButton#EditorialWorkflowButton": EditorialWorkflowButton_343be80d4b57a314839e3f92ff0dba96,
  "/src/components/GenerateSlugButton#GenerateSlugButton": GenerateSlugButton_68a79d9f857f4400dd1a5091bb544cf7,
  "/src/components/EditorialFieldActions#GenerateImageAltButton": GenerateImageAltButton_9fc8e6b15e5f66bee095735f06ab4344,
  "/src/components/GenerateSummaryButton#GenerateSummaryButton": GenerateSummaryButton_8f650de01469eb4d0811a209b22855c9,
  "/src/components/DefineTagsButton#DefineTagsButton": DefineTagsButton_3f6daf68463bf4647f221b892f000bd2,
  "/src/components/EditorialFieldActions#GenerateSocialImagesButton": GenerateSocialImagesButton_9fc8e6b15e5f66bee095735f06ab4344,
  "/src/components/EditorialFieldActions#GenerateSeoFieldsButton": GenerateSeoFieldsButton_9fc8e6b15e5f66bee095735f06ab4344,
  "/src/components/EditorialFieldActions#GenerateFaqFieldsButton": GenerateFaqFieldsButton_9fc8e6b15e5f66bee095735f06ab4344,
  "/src/components/AIFaqGeneratorButton#AIFaqGeneratorButton": AIFaqGeneratorButton_989aa69d921d544baad3872686b8d37d,
  "@payloadcms/storage-s3/client#S3ClientUploadHandler": S3ClientUploadHandler_f97aa6c64367fa259c5bc0567239ef24,
  "@payloadcms/next/rsc#CollectionCards": CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1
}

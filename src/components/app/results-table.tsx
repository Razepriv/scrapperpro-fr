
"use client";

import { useState } from 'react';
import { BedDouble, Bath, Square, MapPin, Building, Globe, CheckCircle, FileText, Clock, Users, Sofa, List, Hash, ChevronDown, Mail, Phone, User, Award, ShieldCheck, FileKey, Building2, Images, Sparkles, Save } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { type Property } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { EnhanceDialog } from './enhance-dialog';
import { PropertyImage } from './property-image';
import { PropertyImageGallery } from './property-image-gallery';

interface ResultsTableProps {
  properties: Property[];
  onSave: (property: Property) => void;
}

interface DetailItemProps {
  icon: React.ElementType;
  label: string;
  value?: string | number | null;
}

const DetailItem: React.FC<DetailItemProps> = ({ icon: Icon, label, value }) => {
  if (value === null || value === undefined || value === '' || (typeof value === 'number' && value === 0)) {
    return null;
  }
  
  const renderValue = () => {
    if (typeof value === 'string' && (value.includes('<p>') || value.includes('<li>'))) {
       return <div className="prose prose-sm max-w-none text-muted-foreground" dangerouslySetInnerHTML={{ __html: value }} />;
    }
    if (typeof value === 'string' && value.startsWith('http')) {
        return (
            <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
            {value}
            </a>
        );
    }
    return <span className="text-muted-foreground break-all">{String(value)}</span>;
  };
  
  return (
    <div className="flex items-start">
      <Icon className="h-4 w-4 mr-2 mt-0.5 text-muted-foreground flex-shrink-0" />
      <div>
        <span className="font-semibold">{label}: </span>
        {renderValue()}
      </div>
    </div>
  );
};

export function ResultsTable({ properties, onSave }: ResultsTableProps) {
  const [enhanceContent, setEnhanceContent] = useState<{ original: string, enhanced: string } | null>(null);

  if (properties.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <p className="text-muted-foreground">No properties scraped yet. Start by scraping a URL, HTML, or a list of URLs.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Accordion type="single" collapsible className="w-full space-y-3">
      {properties.map((prop) => (
        <AccordionItem value={prop.id} key={prop.id} className="border rounded-lg bg-card overflow-hidden transition-all hover:border-primary/20">
          <AccordionTrigger className="p-4 hover:no-underline [&[data-state=open]>div>svg]:rotate-180">
             <div className="flex items-center justify-between gap-4 w-full text-left">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <PropertyImage
                      src={prop.image_url || 'https://placehold.co/600x400.png'}
                      alt={prop.title ?? 'Property image'}
                      className="hidden sm:block w-[120px] h-[80px]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate text-base" title={prop.title ?? undefined}>{prop.title ?? 'Untitled Property'}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3" />
                        {prop.propertyAddress ?? 'N/A'}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                        <Badge variant="secondary" className="text-nowrap">{prop.categories?.join(', ') || (prop as any).property_type || 'N/A'}</Badge>
                        <span className="flex items-center gap-1.5"><BedDouble className="h-4 w-4 text-primary/70" /> {prop.propertyBed ?? 0} beds</span>
                        <span className="flex items-center gap-1.5"><Bath className="h-4 w-4 text-primary/70" /> {prop.propertyBathroom ?? 0} baths</span>
                        <span className="flex items-center gap-1.5"><Square className="h-4 w-4 text-primary/70" /> {prop.propertySize ?? 'N/A'}</span>
                      </div>
                    </div>
                </div>
                <div className="flex items-center gap-4 pl-4">
                    <p className="font-semibold text-lg text-primary text-right">{prop.propertyPrice ?? 'N/A'}</p>
                    <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200 text-muted-foreground" />
                </div>
             </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="px-4 pb-4 border-t pt-4 bg-muted/50 space-y-6">
              
              <div className='flex justify-end gap-2'>
                 <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setEnhanceContent({ original: prop.original_description ?? '', enhanced: prop.description ?? '' })}
                  >
                   <Sparkles className="mr-2" /> View AI Enhancement
                 </Button>
                 <Button size="sm" onClick={() => onSave(prop)}>
                   <Save className="mr-2" /> Save to Database
                  </Button>
              </div>
              <Separator />

              {prop.image_urls && prop.image_urls.length > 0 && (
                <>
                  <div>
                    <h4 className="font-semibold text-base mb-3 flex items-center gap-2"><Images className="h-4 w-4"/> Image Gallery</h4>
                    <PropertyImageGallery
                      propertyId={prop.id}
                      imageUrls={prop.image_urls}
                      title={prop.title ?? 'Image Gallery'}
                    />
                  </div>
                  <Separator />
                </>
              )}

              <div>
                <h4 className="font-semibold text-base mb-3 flex items-center gap-2">Property Details</h4>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                  <div className="space-y-3">
                    <DetailItem icon={Building} label="City" value={prop.city} />
                    <DetailItem icon={MapPin} label="Neighborhood/Area" value={prop.neighborhoodArea} />
                    <DetailItem icon={Globe} label="Country" value={prop.propertyCountry} />
                    {/* Intentionally keeping fewer items here for now, more can be added later */}
                    {/* <DetailItem icon={Hash} label="Floor" value={prop.floor_number} /> */}
                  </div>
                  <div className="space-y-3">
                    <DetailItem icon={CheckCircle} label="Listing Type" value={prop.whatDoYouRent} />
                    <DetailItem icon={Users} label="Tenant Type" value={prop.tenantType} />
                    <DetailItem icon={Sofa} label="Furnishing" value={prop.propertyFurnishingStatus} />
                    <DetailItem icon={FileText} label="Categories" value={prop.categories?.join(', ')} />
                  </div>
                  <div className="space-y-3">
                    <DetailItem icon={Building2} label="Building Info" value={prop.propertyBuilding} />
                    {/* <DetailItem icon={FileText} label="Mortgage" value={prop.mortgage} /> */}
                    <DetailItem icon={FileText} label="Terms" value={prop.termAndCondition} />
                    <DetailItem icon={FileText} label="Display Status" value={prop.propertyDisplayStatus} />
                  </div>
                </div>
              </div>
              
              <Separator />

              <div>
                <h4 className="font-semibold text-base mb-3 flex items-center gap-2"><FileKey className="h-4 w-4"/> Listing & Agency Details</h4>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                    <div className="space-y-3">
                        <DetailItem icon={Award} label="Reference ID" value={prop.reference_id} />
                        <DetailItem icon={FileKey} label="Permit Number" value={prop.permit_number} />
                        <DetailItem icon={User} label="Agent" value={prop.propertyAgent} />
                    </div>
                    <div className="space-y-3">
                        <DetailItem icon={FileKey} label="RERA Registration" value={prop.rera_registration_number} />
                        <DetailItem icon={FileKey} label="DLD BRN" value={prop.dld_brn} />
                        <DetailItem icon={ShieldCheck} label="Validated Info" value={prop.validated_information} />

                    </div>
                     {prop.page_link && 
                        <div className="flex items-start">
                            <Globe className="h-4 w-4 mr-2 mt-0.5 text-muted-foreground flex-shrink-0" />
                            <div>
                                <span className="font-semibold">Page Link: </span>
                                <a href={prop.page_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{prop.page_link}</a>
                            </div>
                        </div>
                      }
                </div>
              </div>
              
              <Separator />

              <div>
                <h4 className="font-semibold text-base mb-3 flex items-center gap-2"><User className="h-4 w-4"/> Agent/Lister Information</h4>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                    <div className="space-y-3">
                        <DetailItem icon={User} label="Listed By" value={prop.listed_by_name} />
                    </div>
                    <div className="space-y-3">
                        <DetailItem icon={Phone} label="Phone" value={prop.listed_by_phone} />
                    </div>
                    <div className="space-y-3">
                        <DetailItem icon={Mail} label="Email" value={prop.listed_by_email} />
                    </div>
                </div>
              </div>
              
              {prop.featuresAndAmenities && prop.featuresAndAmenities.length > 0 && (
                <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2 text-base"><List className="h-4 w-4"/> Features & Amenities</h4>
                  <div className="flex flex-wrap gap-2">
                    {prop.featuresAndAmenities.map((feature, index) => <Badge key={index} variant="outline">{feature}</Badge>)}
                  </div>
                </div>
                </>
              )}

              {prop.description && ( // This is the main 'Content' field
                <>
                <Separator />
                <div className="space-y-2">
                   <h4 className="font-semibold flex items-center gap-2 text-base">Content / Description</h4>
                   <div className="prose prose-sm max-w-none text-muted-foreground" dangerouslySetInnerHTML={{ __html: prop.description }} />
                </div>
                </>
              )}

              {/* Adding a section for some of the new boolean flags if present */}
              {(prop.featuredProperty || prop.platinumProperty || prop.premiumProperty) && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2 text-base">Property Status Flags</h4>
                    <div className="flex flex-wrap gap-2">
                      {prop.featuredProperty && <Badge variant="outline">Featured</Badge>}
                      {prop.platinumProperty && <Badge variant="outline">Platinum</Badge>}
                      {prop.premiumProperty && <Badge variant="outline">Premium</Badge>}
                    </div>
                  </div>
                </>
              )}

              <Separator />
              
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>

    <EnhanceDialog 
      isOpen={!!enhanceContent}
      onClose={() => setEnhanceContent(null)}
      content={enhanceContent}
    />
    </>
  );
}

// A new Badge variant "special" might need to be defined in ui/badge.tsx or tailwind config
// For now, it will fall back to default styling if "special" is not defined.
